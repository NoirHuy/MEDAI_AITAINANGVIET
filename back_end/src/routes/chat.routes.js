import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { attachUserIfPresent } from '../middleware/auth.js'
import { generateReply, estimateTokens } from '../services/aiReplyService.js'
import { incrementUsage } from '../db/usersRepo.js'

const router = Router()

// Chat works for guests too (no requireAuth) — only logged-in users get
// their token usage tracked, matching the frontend's "no login wall for
// chatting" UX.
router.post(
  '/',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const { messages, specialtyId, lang } = req.body ?? {}
    console.log(`[API CHAT] Incoming request specialtyId: "${specialtyId}", lang: "${lang}", messages count: ${messages?.length}`)
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
    // res (not req) 'close' fires when the underlying connection is
    // terminated. req 'close' fires as soon as the request body has been
    // fully read, which happens almost immediately for a small POST body —
    // using that would abort generation right after it starts.
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    req.socket.setKeepAlive(true)
    req.socket.setTimeout(0) // Tắt thời gian chờ socket để tránh bị ngắt kết nối giữa chừng khi streaming

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('X-Accel-Buffering', 'no') // Ép Nginx/Hugging Face Proxy không buffer stream
    res.setHeader('Connection', 'keep-alive')

    let full = ''
    try {
      full = await generateReply({
        messages,
        specialtyId,
        lang: lang || 'vi',
        signal: controller.signal,
        onChunk: (chunk) => res.write(chunk),
      })
    } catch (err) {
      const isAbort = err.name === 'AbortError' || err.message === 'aborted' || controller.signal.aborted
      if (!isAbort) {
        console.error('[API CHAT Error]', err)
        res.write(`\n\n⚠️ **Cảnh báo hệ thống:** Mất kết nối y khoa (${err.message}). Vui lòng kiểm tra lại cấu hình API hoặc đường truyền mạng của bạn.`)
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

export default router
