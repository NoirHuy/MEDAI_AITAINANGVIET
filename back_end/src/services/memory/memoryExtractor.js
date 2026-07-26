import { env } from '../../config/env.js'
import { UserMemoryModel } from '../../db/user_memory.model.js'
import { logMemoryAudit } from '../../db/memory_audit.model.js'
import { getUserMemorySettings } from '../../db/user_memory_settings.model.js'
import { encryptText, decryptText } from '../../utils/memoryCrypto.js'
import { validateMedicalCandidates } from './medicalValidator.js'

/**
 * Runs an asynchronous background AI memory extraction pass after chat completion.
 * Protected by failure isolation wrapper so errors NEVER crash chat responses.
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.conversationId
 * @param {Array} params.messages
 */
export async function runMemoryExtractionPass({ userId, conversationId, messages }) {
  if (!userId || !Array.isArray(messages) || messages.length === 0) return

  // Failure isolation wrapper
  try {
    const settings = await getUserMemorySettings(userId)
    if (!settings.memoryEnabled) return

    // Check user memory count limit
    const activeCount = await UserMemoryModel.countDocuments({ userId, status: 'active' })
    if (activeCount >= (env.memoryMaxPerUser || 500)) {
      console.log(`[MemoryExtractor] User ${userId} reached memory limit (${activeCount}/${env.memoryMaxPerUser}). Skipping extraction.`)
      return
    }

    const apiKey = env.llmApiKey
    if (!apiKey) return

    // Prepare text for LLM extraction pass
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Bệnh nhân' : 'Bác sĩ/Bot'}: ${m.content}`)
      .slice(-6)
      .join('\n')

    const extractionPrompt = `Bạn là Chuyên gia Trích xuất Dữ liệu Y tế Cá nhân. Hãy đọc đoạn hội thoại sau và trích xuất các THÔNG TIN Y TẾ XÁC THỰC CỦA BỆNH NHÂN (Dị ứng, Bệnh nền, Thuốc đang dùng, Nhóm máu, Thai kỳ, Đợt bệnh ngắn hạn, Lối sống).

NẰM LÒNG QUY TẮC PHÂN LOẠI:
- medicalStatus: 'confirmed' (Chỉ trích xuất câu XÁC THỰC của bệnh nhân. NẾU bệnh nhân đặt câu hỏi hoặc giả định như "Nếu tôi bị ung thư thì sao?" -> BỎ QUA).
- subject: 'self' (Bản thân bệnh nhân) hoặc 'family' (Tiền sử gia đình như "Mẹ tôi bị tiểu đường").
- category: 'allergy' | 'chronic_condition' | 'medication' | 'blood_type' | 'pregnancy' | 'past_episode' | 'lifestyle' | 'display_preference'.
- memoryType: 'fact' | 'preference' | 'episode' | 'observation'.
- importance: 'critical' | 'high' | 'medium' | 'low'.
- confidence: Số thực từ 0.0 đến 1.0.

HỘI THOẠI:
${conversationText}

Trả về định dạng JSON thuần duy nhất dạng mảng:
[
  {
    "category": "allergy",
    "memoryType": "fact",
    "content": "Dị ứng Penicillin gây phát ban",
    "subject": "self",
    "importance": "critical",
    "medicalStatus": "confirmed",
    "confidence": 0.95
  }
]
`

    const response = await fetch(`${env.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.openrouterModelNer || 'gemini/gemini-3.1-flash-lite-preview',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.1,
      }),
    })

    if (!response.ok) return
    const data = await response.json()
    const rawOutput = data.choices?.[0]?.message?.content || ''

    const jsonMatch = rawOutput.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return

    const parsedCandidates = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsedCandidates) || parsedCandidates.length === 0) return

    // Medical Validation & Confidence Filter
    const validCandidates = validateMedicalCandidates(parsedCandidates)
    if (validCandidates.length === 0) return

    // Fetch current active user memories for semantic deduplication & conflict resolution
    const existingMemories = await UserMemoryModel.find({ userId, status: 'active' }).lean()
    const decryptedExisting = existingMemories.map(m => ({
      ...m,
      decryptedContent: decryptText(m.content, m.keyVersion || 1),
    }))

    for (const candidate of validCandidates) {
      // Find matching existing memory in the same category & subject
      const existingMatch = decryptedExisting.find(
        m => m.category === candidate.category && m.subject === candidate.subject
      )

      if (existingMatch) {
        // Human Override Check: Locked memories MUST NEVER be modified by AI
        if (existingMatch.isLocked) {
          console.log(`[MemoryExtractor] Memory ${existingMatch.id} is locked by user. AI modification ignored.`)
          continue
        }

        const candidateLower = candidate.content.toLowerCase()
        const existingLower = existingMatch.decryptedContent.toLowerCase()

        // Check Duplicate / Exact Match
        if (candidateLower === existingLower || existingLower.includes(candidateLower)) {
          // Update lastConfirmedAt & verificationStatus
          await UserMemoryModel.updateOne(
            { id: existingMatch.id },
            { $set: { lastConfirmedAt: new Date(), verificationStatus: 'verified' } }
          )
          continue
        }

        // Semantic Conflict / Superseded Update: Mark old as superseded and create new active item with previousVersionId
        await UserMemoryModel.updateOne(
          { id: existingMatch.id },
          { $set: { status: 'superseded' } }
        )

        await logMemoryAudit({
          memoryId: existingMatch.id,
          userId,
          action: 'supersede',
          performedBy: 'ai',
          previousContent: existingMatch.decryptedContent,
          newContent: candidate.content,
          meta: { reason: 'AI detected updated medical condition', conversationId },
        })

        // Create new active memory version
        const encryptedContent = encryptText(candidate.content, 1)
        let expiresAt = null
        if (candidate.category === 'past_episode') {
          expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }

        const newMem = await UserMemoryModel.create({
          userId,
          category: candidate.category,
          memoryType: candidate.memoryType || 'fact',
          content: encryptedContent,
          keyVersion: 1,
          status: 'active',
          subject: candidate.subject || 'self',
          importance: candidate.importance || 'medium',
          medicalStatus: 'confirmed',
          confidence: candidate.confidence,
          source: 'conversation',
          isLocked: false,
          version: (existingMatch.version || 1) + 1,
          previousVersionId: existingMatch.id,
          conversationId,
          extractedAt: new Date(),
          lastConfirmedAt: new Date(),
          verificationStatus: 'verified',
          expiresAt,
        })

        await logMemoryAudit({
          memoryId: newMem.id,
          userId,
          action: 'create',
          performedBy: 'ai',
          newContent: candidate.content,
          meta: { conversationId, previousVersionId: existingMatch.id },
        })
      } else {
        // Entirely new memory item
        const encryptedContent = encryptText(candidate.content, 1)
        let expiresAt = null
        if (candidate.category === 'past_episode') {
          expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }

        const newMem = await UserMemoryModel.create({
          userId,
          category: candidate.category,
          memoryType: candidate.memoryType || 'fact',
          content: encryptedContent,
          keyVersion: 1,
          status: 'active',
          subject: candidate.subject || 'self',
          importance: candidate.importance || 'medium',
          medicalStatus: 'confirmed',
          confidence: candidate.confidence,
          source: 'conversation',
          isLocked: false,
          version: 1,
          conversationId,
          extractedAt: new Date(),
          lastConfirmedAt: new Date(),
          verificationStatus: 'verified',
          expiresAt,
        })

        await logMemoryAudit({
          memoryId: newMem.id,
          userId,
          action: 'create',
          performedBy: 'ai',
          newContent: candidate.content,
          meta: { conversationId },
        })
      }
    }
  } catch (err) {
    // Failure isolation: catch all errors silently so chat NEVER crashes
    console.error('[MemoryExtractor] Background extraction error (isolated):', err)
  }
}
