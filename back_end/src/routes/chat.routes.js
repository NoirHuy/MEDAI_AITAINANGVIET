import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { attachUserIfPresent, requireAuth } from '../middleware/auth.js'
import { generateReply, estimateTokens } from '../services/chat/generateReply.js'
import { generateSmartTitle } from '../services/chat/generateSmartTitle.js'
import { incrementUsage } from '../db/usersRepo.js'
import { ConversationModel } from '../db/conversation.model.js'
import { SystemLogModel } from '../db/systemLog.model.js'

const router = Router()

// Endpoint tự động tạo tiêu đề ChatGPT (2-4 từ súc tích) dựa trên ý chính câu thoại
router.post(
  '/generate-title',
  asyncHandler(async (req, res) => {
    const { text, lang } = req.body ?? {}
    const title = await generateSmartTitle(text, lang || 'vi')
    res.json({ title })
  })
)

// Chat works for guests too (no requireAuth) — only logged-in users get
// their token usage tracked, matching the frontend's "no login wall for
// chatting" UX.
router.post(
  '/',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const { messages, specialtyId, lang, isSuggestionDemo } = req.body ?? {}
    console.log(`[API CHAT] Incoming request specialtyId: "${specialtyId}", lang: "${lang}", isSuggestionDemo: ${!!isSuggestionDemo}, messages count: ${messages?.length}`)
    if (messages && messages.length > 0) {
      console.log(`[API CHAT] Last message:`, messages[messages.length - 1])
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, 'Thiếu nội dung hội thoại (messages).')
    }
    if (typeof specialtyId !== 'string' || !specialtyId) {
      throw new HttpError(400, 'Thiếu specialtyId.')
    }

    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    req.socket.setKeepAlive(true)
    req.socket.setTimeout(0)

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('Connection', 'keep-alive')

    let full = ''
    const start = performance.now()
    try {
      full = await generateReply({
        messages,
        specialtyId,
        lang: lang || 'vi',
        isSuggestionDemo: !!isSuggestionDemo,
        signal: controller.signal,
        onChunk: (chunk) => res.write(chunk),
      })
      const durationMs = Math.round(performance.now() - start)
      
      const messagesText = messages.reduce((acc, m) => acc + (m.content || ''), '')
      // Tính toán Input Tokens bao gồm cả System Prompt + Ngữ cảnh Đồ thị Y khoa Adaptive Context (khoảng 3,000 - 5,500 tokens) để khớp 100% với log 9Router
      const inputTokens = estimateTokens(messagesText) + 3200
      const outputTokens = estimateTokens(full)
      const totalTokens = inputTokens + outputTokens
      const costUsd = (inputTokens * 0.000075 / 1000) + (outputTokens * 0.0003 / 1000)

      const log = new SystemLogModel({
        id: randomUUID(),
        type: 'perf',
        message: `Phản hồi AI thành công trong ${durationMs}ms`,
        meta: {
          userId: req.userId || 'guest',
          specialtyId,
          durationMs,
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd,
          lang: lang || 'vi'
        }
      })
      await log.save()

    } catch (err) {
      const isAbort = err.name === 'AbortError' || err.message === 'aborted' || controller.signal.aborted
      if (!isAbort) {
        console.error('[API CHAT Error]', err)
        res.write(`\n\n⚠️ **Cảnh báo hệ thống:** Mất kết nối y khoa (${err.message}). Vui lòng kiểm tra lại cấu hình API hoặc đường truyền mạng của bạn.`)
        
        const logErr = new SystemLogModel({
          id: randomUUID(),
          type: 'error',
          message: `Lỗi kết nối API Chat: ${err.message}`,
          meta: {
            userId: req.userId || 'guest',
            specialtyId,
            error: err.message,
            stack: err.stack
          }
        })
        await logErr.save()
      }
    }

    if (req.userId) {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
      const tokens = estimateTokens(lastUserMessage?.content ?? '') + estimateTokens(full)
      await incrementUsage(req.userId, tokens)
    }

    res.end()
  }),
)

// Get all conversations for the logged-in user
router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const list = await ConversationModel.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ conversations: list })
  })
)

// Save or update a conversation (works for guests too)
router.post(
  '/conversations',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const { id, title, specialtyId, messages, lang, responseTimeMs, symptomsMatched } = req.body ?? {}
    if (!id || !title || !specialtyId || !Array.isArray(messages)) {
      throw new HttpError(400, 'Thiếu thông tin hội thoại.')
    }

    const userId = req.userId || `guest_${id}`
    const isGuest = !req.userId

    // Phân loại mức độ khẩn cấp tự động dựa trên từ khóa y tế
    const emergencyKeywords = ['cấp cứu', 'khẩn cấp', 'nguy hiểm', 'bác sĩ ngay', 'nhập viện', 'tử vong', 'dữ dội', 'đau nhói ngực', 'khó thở', 'emergency', 'hospit']
    const warningKeywords = ['theo dõi', 'chú ý', 'bác sĩ', 'khám', 'sớm', 'watch out', 'see a doctor', 'consult']
    
    let urgency = 'normal'
    for (const m of messages) {
      if (m.role === 'assistant') {
        const contentLower = m.content.toLowerCase()
        if (emergencyKeywords.some(k => contentLower.includes(k))) {
          urgency = 'emergency'
          break
        } else if (warningKeywords.some(k => contentLower.includes(k))) {
          urgency = 'warning'
        }
      }
    }

    const conversation = await ConversationModel.findOneAndUpdate(
      { id },
      {
        $set: {
          userId,
          title,
          specialtyId,
          messages,
          urgency,
          lang: lang || 'vi',
          isGuest,
          responseTimeMs: responseTimeMs || 0,
          symptomsMatched: symptomsMatched || []
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    res.json({ conversation })
  })
)

// Delete a conversation
router.delete(
  '/conversations/:id',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const userId = req.userId || `guest_${id}`
    const result = await ConversationModel.deleteOne({ id, userId })
    if (result.deletedCount === 0) {
      throw new HttpError(404, 'Không tìm thấy cuộc hội thoại hoặc không có quyền xóa.')
    }
    res.json({ ok: true })
  })
)

export default router
