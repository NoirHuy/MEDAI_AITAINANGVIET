import { env } from '../../config/env.js'
import { getSpecialty } from '../../config/specialties.js'
import { auditLog } from '../../utils/auditLog.js'
import { streamText } from '../llm/streaming.js'
import { callLLM } from '../llm/llmClient.js'
import { renderSystemPrompt } from '../prompts/promptRegistry.js'
import { computeAdaptiveContext } from '../graphrag/adaptiveContext.js'
import { extractSymptomsFromHistory } from '../graphrag/symptomExtraction.js'
import { formatAdaptiveContext } from '../graphrag/formatContext.js'
import { evaluatePhase } from './phaseEvaluator.js'
import { getSCEState, mergeSCEState, setSCEState } from '../graphrag/sceStateCache.js'
import { getStaticSuggestionReply } from './staticSuggestionReplies.js'
import { detectIntent, streamQuickReply, streamRefusalReply } from './intentClassifier.js'

function buildMockReply(userText, specialtyId, lang = 'vi') {
  const specialty = getSpecialty(specialtyId)
  const isEn = lang === 'en'
  const name = isEn ? specialty.name.en : specialty.name.vi

  if (isEn) {
    return `[Demo Mode — OPENROUTER_API_KEY not configured]\n\n` +
      `Thank you for contacting MedChat247 specialty **${name}**. ` +
      `Please add your API Key in the \`.env\` file to activate real AI ` +
      `integrated with the NLICE clinical knowledge graph.\n\n` +
      `*Instructions: Open \`medchat/back_end/.env\` and fill in \`OPENROUTER_API_KEY=...\`*`
  }

  return `[Chế độ demo — chưa cấu hình OPENROUTER_API_KEY]\n\n` +
    `Cảm ơn bạn đã liên hệ với MedChat247 chuyên khoa **${name}**. ` +
    `Vui lòng thêm API Key vào tệp \`.env\` để kích hoạt trí tuệ nhân tạo thật sự ` +
    `tích hợp đồ thị tri thức lâm sàng NLICE.\n\n` +
    `*Hướng dẫn: Mở \`medchat/back_end/.env\` và điền vào \`OPENROUTER_API_KEY=...\`*`
}

import { getActiveMemoryContext } from '../memory/memoryRetrieval.js'

export async function generateReply({ messages, specialtyId, lang = 'vi', isSuggestionDemo = false, suggestionId = null, userId = null, sessionMemoryPaused = false, conversationId = null, onChunk, signal }) {
  const isEn = lang === 'en'
  const performanceMeta = {}
  const measureStage = async (name, operation) => {
    const startedAt = performance.now()
    try {
      return await operation()
    } finally {
      performanceMeta[name] = Math.round(performance.now() - startedAt)
    }
  }

  const staticSuggestionReply = specialtyId === 'health_consultation'
    ? getStaticSuggestionReply(suggestionId, lang)
    : null
  if (staticSuggestionReply) {
    const fullReplyText = await streamText(staticSuggestionReply, onChunk, signal, {
      thinkingDelayMs: 600,
      tokenDelayMs: 15,
    })
    return { fullReplyText, memoriesUsed: [], performanceMeta: { staticSuggestionReply: true } }
  }

  // ── INTENT-BASED ROUTING ──────────────────────────────────────────────────────
  const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  const intent = await detectIntent(lastUserText, lang)

  // Fast path: quick responses (no LLM, no GraphRAG)
  if (intent.type === 'quick') {
    const fullReplyText = await streamQuickReply(lang, intent.subtype, onChunk, signal)
    return { fullReplyText, memoriesUsed: [], performanceMeta: { intent: 'quick', subtype: intent.subtype } }
  }

  // Out-of-scope: refusal (no LLM, no GraphRAG)
  if (intent.type === 'refusal') {
    const fullReplyText = await streamRefusalReply(lang, onChunk, signal)
    return { fullReplyText, memoriesUsed: [], performanceMeta: { intent: 'refusal' } }
  }
  // SYMPTOM_QUERY: fall through to existing full GraphRAG pipeline below
  // ─────────────────────────────────────────────────────────────────────────────

  // No API Key: hard error in production; dev-only mock via flag
  if (!env.llmApiKey) {
    const msg = '[generateReply] NINEROUTER_API is not configured. Set NINEROUTER_API in back_end/.env.'
    if (env.isProd) {
      console.error(msg)
      throw new Error('AI service is not configured. Please contact the administrator.')
    }
    console.warn(msg)
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const fullReplyText = await streamText(buildMockReply(lastUser?.content ?? '', specialtyId, lang), onChunk, signal)
    return { fullReplyText, memoriesUsed: [], performanceMeta }
  }

  // TRUE ADAPTIVE GRAPHRAG for Health Consultation specialty
  if (specialtyId === 'health_consultation' || specialtyId === 'pediatrics') {
    let adaptiveCtx = null
    let sceResult = null
    let memoryPromptBlock = ''
    let memoriesUsed = []
    
    try {
      const userMessageCount = messages.filter((message) => message.role === 'user').length
      
      // OPTIMIZATION: Parallelize independent operations that don't depend on each other
      const [firstCtx, previousSCE, memRes] = await Promise.all([
        measureStage('loadSymptomCatalogMs', () => computeAdaptiveContext(new Set(), new Set())),
        specialtyId === 'health_consultation' ? getSCEState(conversationId, userMessageCount) : Promise.resolve(null),
        userId && !sessionMemoryPaused 
          ? measureStage('memoryRetrievalMs', () => getActiveMemoryContext(userId, lastUserText))
          : Promise.resolve({ promptBlock: '', memoriesUsed: [] })
      ])
      
      if (memRes) {
        memoryPromptBlock = memRes.promptBlock
        memoriesUsed = memRes.memoriesUsed
      }
      
      // INCREMENTAL EXTRACTION: Only extract from new messages if we have previous SCE state
      const messagesForExtraction = previousSCE
        ? [messages.filter((message) => message.role === 'user').at(-1)]
        : messages
      
      auditLog('SCE_EXTRACTION', 'Info', 
        `Extracting SCE from ${messagesForExtraction.length} message(s) - ${previousSCE ? 'incremental' : 'full'} mode`)
      
      const extractedSCE = await measureStage('symptomExtractionMs', () =>
        extractSymptomsFromHistory(messagesForExtraction, firstCtx.allSymptoms, lang),
      )
      sceResult = previousSCE ? mergeSCEState(previousSCE, extractedSCE) : extractedSCE
      if (specialtyId === 'health_consultation') {
        await setSCEState(conversationId, userMessageCount, sceResult)
      }
      adaptiveCtx = await measureStage('graphRankingMs', () => computeAdaptiveContext(sceResult))
    } catch (err) {
      auditLog('Adaptive GraphRAG', 'Error', err.message, 'error')
      throw err
    }

    const checklistStatus = {
      hasAgeSex: !!(sceResult?.demographics?.age || sceResult?.demographics?.sex),
      hasDuration: !!(sceResult?.temporal?.durationValue),
      hasSeverity: !!(sceResult?.symptoms?.some(s => s.status === 'positive' && s.attributes?.severity))
    }

    const userMessages = messages.filter((m) => m.role === 'user')
    const turnCount = userMessages.length

    const phaseInfo = evaluatePhase({ checklistStatus, sceResult, turnCount, isSuggestionDemo })
    const phase = phaseInfo.phase

    const adaptiveText = adaptiveCtx
      ? formatAdaptiveContext(adaptiveCtx, lang)
      : (isEn ? '*[No graph data yet — please ask for symptoms]*' : '*[Chưa có dữ liệu đồ thị — hãy hỏi triệu chứng ban đầu]*')

    let systemPrompt = renderSystemPrompt(specialtyId, lang, {
      checklistStatus,
      phase,
      ADAPTIVE_CONTEXT: adaptiveText
    })

    if (memoryPromptBlock) {
      systemPrompt += `\n\n${memoryPromptBlock}`
    }

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    const maxTokens = phase === 1 ? 800 : 2500
    const fullReplyText = await measureStage('answerGenerationMs', () => callLLM({
      messages: chatMessages,
      model: env.openrouterModelChat,
      stream: true,
      maxTokens,
      onChunk,
      signal
    }))

    return { fullReplyText, memoriesUsed, performanceMeta }
  }

  // Other specialties (General, Dermatology, Nutrition)
  let memoryPromptBlock = ''
  let memoriesUsed = []
  
  if (userId && !sessionMemoryPaused) {
    try {
      const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content || ''
      const memRes = await measureStage('memoryRetrievalMs', () => getActiveMemoryContext(userId, lastUserText))
      memoryPromptBlock = memRes.promptBlock
      memoriesUsed = memRes.memoriesUsed
    } catch (e) {
      console.error('[GenerateReply] Memory retrieval error:', e)
    }
  }
  
  let systemPrompt = renderSystemPrompt(specialtyId, lang, {})
  if (memoryPromptBlock) {
    systemPrompt += `\n\n${memoryPromptBlock}`
  }

  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ]
  const fullReplyText = await measureStage('answerGenerationMs', () => callLLM({
    messages: chatMessages,
    model: null,
    stream: true,
    maxTokens: 1500,
    onChunk,
    signal
  }))

  return { fullReplyText, memoriesUsed, performanceMeta }
}

export function estimateTokens(text) {
  return text ? Math.ceil(text.length / 4) : 0
}
