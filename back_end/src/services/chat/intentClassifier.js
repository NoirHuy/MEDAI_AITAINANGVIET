import { env } from '../../config/env.js'
import { callLLM } from '../llm/llmClient.js'
import { streamText } from '../llm/streaming.js'

/**
 * Intent types for routing decisions.
 * @typedef {'quick' | 'refusal' | 'symptom_query'} IntentType
 * @typedef {'greeting' | 'thanks' | 'farewell' | 'bot_identity'} QuickSubtype
 */

/**
 * @typedef {Object} IntentResult
 * @property {IntentType} type
 * @property {QuickSubtype} [subtype]
 * @property {number} confidence
 */

// Quick-response subtype patterns (evaluated in order)
const QUICK_SUBTYPE_PATTERNS = [
  {
    subtype: 'greeting',
    patterns: [
      /^hi[.!]?\s*$/i,
      /^hello[.!]?\s*$/i,
      /^hey[.!]?\s*$/i,
      /^chào[.!]?\s*$/i,
      /^xin chào[.!]?\s*$/i,
      /^namaste[.!]?\s*$/i,
      /^halo[.!]?\s*$/i,
      /^good morning[.!]?\s*$/i,
      /^good afternoon[.!]?\s*$/i,
      /^good evening[.!]?\s*$/i,
    ],
  },
  {
    subtype: 'thanks',
    patterns: [
      /^cảm ơn/i,
      /^cám ơn/i,
      /^thank you/i,
      /^thanks[.!]?\s*$/i,
      /^thank\b/i,
    ],
  },
  {
    subtype: 'farewell',
    patterns: [
      /^tạm biệt/i,
      /^goodbye[.!]?\s*$/i,
      /^bye[.!]?\s*$/i,
      /^see you/i,
      /^hẹn gặp lại/i,
    ],
  },
  {
    subtype: 'bot_identity',
    patterns: [
      /^bạn là ai/i,
      /^who are you/i,
      /^what are you/i,
      /^what can you do/i,
      /^tell me about this/i,
      /^giới thiệu.*medchat/i,
      /^medchat là gì/i,
    ],
  },
]

/**
 * Symptom keywords that should always route to full GraphRAG pipeline.
 * Used as a fast heuristic before making the LLM classification call.
 */
const SYMPTOM_KEYWORDS_VI = [
  // Cảm giác đau / nhức / mỏi
  'đau', 'nhức', 'nhứt', 'mỏi', 'buốt', 'rát', 'nhói', 'quặn', 'âm ỉ', 'tê',
  'tê bì', 'tê buốt', 'đau nhức', 'nhức mỏi', 'đau đầu', 'nhức đầu', 'nhứt đầu',
  'đau bụng', 'đau họng', 'rát họng', 'rát cổ', 'đau ngực', 'tức ngực', 'nặng ngực',
  'đau lưng', 'đau cơ', 'đau khớp', 'chuột rút', 'co rút', 'căng cơ',
  // Sốt & Thân nhiệt
  'sốt', 'nóng sốt', 'ớn lạnh', 'gai rét', 'rét run', 'lạnh run', 'vã mồ hôi', 'mồ hôi trộm',
  // Hô hấp & Tai Mũi Họng
  'ho', 'khó thở', 'thở dốc', 'thở gấp', 'khò khè', 'hụt hơi', 'nghẹt mũi', 'ngạt mũi',
  'sổ mũi', 'chảy mũi', 'chảy nước mũi', 'hắt hơi', 'hắt xì', 'khó nuốt', 'nuốt vướng',
  'khàn tiếng', 'khàn giọng', 'mất tiếng',
  // Tiêu hóa
  'buồn nôn', 'nôn', 'nôn nao', 'mắc ói', 'mắc nôn', 'ói', 'tiêu chảy', 'ỉa chảy',
  'đi ngoài', 'đi phân lỏng', 'táo bón', 'chướng bụng', 'đầy hơi', 'đầy bụng', 'khó tiêu',
  'ợ chua', 'ợ hơi', 'ợ nóng', 'trào ngược', 'cồn cào', 'chán ăn', 'sụt cân',
  // Thần kinh & Toàn thân
  'chóng mặt', 'choáng', 'choáng váng', 'hoa mắt', 'xây xẩm', 'chao đảo', 'mất thăng bằng',
  'mệt mỏi', 'mệt', 'uể oải', 'lừ đừ', 'đuối', 'kiệt sức', 'mất ngủ', 'khó ngủ', 'lo âu',
  'co giật', 'run tay', 'run chân', 'mất vị giác', 'mất khứu giác',
  // Da & Dị ứng & Tiết niệu
  'phát ban', 'sưng', 'chảy máu', 'chảy dịch', 'ngứa', 'ngứa ngáy', 'nổi mẩn', 'mề đay',
  'nổi mề đay', 'nổi hột', 'nổi mụn', 'dị ứng', 'mụn nhọt', 'nổi hạch', 'sưng hạch',
  'tiểu buốt', 'tiểu rắt', 'tiểu đêm', 'tiểu nhiều', 'tiểu ra máu', 'tiểu khó', 'đái buốt',
  // Ngữ cảnh y tế chung
  'bị ', 'bị bệnh', 'mắc bệnh', 'nhiễm bệnh', 'khám', 'thuốc', 'uống thuốc', 'bác sĩ',
  'triệu chứng', 'dấu hiệu', 'tư vấn', 'sức khỏe',
]

const SYMPTOM_KEYWORDS_EN = [
  // Pain / Aches
  'pain', 'ache', 'aching', 'headache', 'toothache', 'stomachache', 'backache',
  'sore', 'hurts', 'hurting', 'throbbing', 'cramp', 'cramps', 'stiff', 'stiffness',
  'sore throat', 'chest pain', 'back pain', 'stomach pain', 'abdominal pain',
  'muscle pain', 'joint pain',
  // Fever / Temperature
  'fever', 'feverish', 'chills', 'shivering', 'sweating', 'night sweats',
  // Respiratory / ENT
  'cough', 'coughing', 'sneezing', 'sneeze', 'runny nose', 'stuffy nose', 'congestion',
  'shortness of breath', 'breathless', 'wheezing', 'difficulty swallowing', 'hoarse',
  // Gastrointestinal
  'nausea', 'nauseous', 'vomit', 'vomiting', 'diarrhea', 'constipation', 'bloating',
  'indigestion', 'heartburn', 'acid reflux', 'loss of appetite', 'weight loss',
  // Neuro / Systemic
  'dizzy', 'dizziness', 'lightheaded', 'vertigo', 'faint', 'fainting',
  'tired', 'fatigue', 'exhausted', 'weakness', 'insomnia', 'anxiety', 'numbness', 'tingling',
  // Skin / Urinary
  'rash', 'swelling', 'swollen', 'bleeding', 'itchy', 'itching', 'hives', 'allergies',
  'burning urination', 'frequent urination',
  // General
  'sick', 'ill', 'symptom', 'symptoms', 'medicine', 'medication', 'doctor', 'consult',
]

/**
 * Quick replies for each subtype and language.
 */
const QUICK_REPLIES = {
  greeting_vi: 'Chào bạn! Tôi là trợ lý y khoa MedChat247. Bạn đang gặp triệu chứng gì hôm nay?',
  greeting_en: "Hello! I'm MedChat247 medical assistant. What symptoms are you experiencing today?",
  thanks_vi: 'Cảm ơn bạn! Nếu có gì thắc mắc thêm, cứ hỏi tôi nhé.',
  thanks_en: "You're welcome! Feel free to ask if you have more questions.",
  farewell_vi: 'Tạm biệt! Chúc bạn sức khỏe. Hẹn gặp lại!',
  farewell_en: 'Goodbye! Take care. See you next time!',
  bot_identity_vi: 'Tôi là MedChat247 – trợ lý sức khỏe AI. Tôi có thể hỏi triệu chứng, tư vấn bệnh lý, và hướng dẫn chăm sóc sức khỏe. Bạn cần hỗ trợ gì hôm nay?',
  bot_identity_en: "I'm MedChat247 – AI health assistant. I can help with symptom assessment, disease guidance, and health advice. How can I help you today?",
}

/**
 * Refusal replies for out-of-scope queries.
 */
const REFUSAL_REPLIES = {
  vi: 'Xin lỗi, tôi chỉ hỗ trợ **sàng lọc triệu chứng** và **tư vấn sức khỏe dựa trên triệu chứng** mà bạn đang gặp. Nếu bạn có triệu chứng cần thảo luận, hãy mô tả nhé!',
  en: "I'm sorry, I can only help with **symptom-based health screening**. If you have symptoms you'd like to discuss, please describe them and I'll assist!",
}

/**
 * Determines the quick-response subtype from a user message.
 * Returns null if the message does not match any quick pattern.
 * @param {string} text
 * @returns {QuickSubtype | null}
 */
export function classifyQuickSubtype(text) {
  const trimmed = text.trim()
  for (const { subtype, patterns } of QUICK_SUBTYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return subtype
      }
    }
  }
  return null
}

/**
 * Clinical intake and demographic patterns (age, sex, duration, onset, locations, yes/no clarifications).
 * Answers to clinical intake questions should always be treated as part of the medical consultation.
 */
const CLINICAL_INTAKE_PATTERNS_VI = [
  // Tuổi / Giới tính / Nhân khẩu học
  /\b(\d{1,3}\s*(tuổi|tháng|t|yo|năm tuổi))\b/i,
  /\b(tôi|mình|em|cháu|bác|chú|cô|anh|chị|bé)\s+(\d{1,3})\s*(tuổi|tháng|t)?\b/i,
  /\b(nam|nữ|trai|gái|đàn ông|phụ nữ)\b/i,
  // Thời gian & Khởi phát
  /\b(\d{1,3}\s*(ngày|tuần|tháng|năm|giờ|tiếng|phút)\s*(nay|rồi|trước|qua)?)\b/i,
  /\b(hôm qua|sáng nay|tối qua|trưa nay|hôm kia|đêm qua|vừa mới|mới bị|bắt đầu|kéo dài|liên tục|từng cơn)\b/i,
  // Vị trí & Tính chất cơn đau/cảm giác
  /\b(quanh rốn|thượng vị|hạ vị|hạ sườn|bên phải|bên trái|ở bụng|ở ngực|ở đầu|ở họng|ở lưng|ở cổ|ở chân|ở tay)\b/i,
  /\b(nhức|nhứt|âm ỉ|quặn|nhói|buốt|rát|dữ dội|râm ran|châm chích|nặng|nhẹ|mỏi|tê|choáng|chóng mặt)\b/i,
  // Trả lời có/không, xác nhận, phủ nhận cho câu hỏi lâm sàng
  /\b(có|không|chưa|vâng|đúng|dạ|rồi|ko|k|kô)\b/i,
]

const CLINICAL_INTAKE_PATTERNS_EN = [
  // Age / Sex / Demographics
  /\b(\d{1,3}\s*(years?\s*old|yo|months?\s*old))\b/i,
  /\b(i\s*am|i'm)\s+(\d{1,3})\s*(years?\s*old|yo)?\b/i,
  /\b(male|female|man|woman|boy|girl)\b/i,
  // Temporal & Duration
  /\b(\d{1,3}\s*(days?|weeks?|months?|years?|hours?|minutes?))\b/i,
  /\b(yesterday|today|last night|this morning|started|for \d+|since)\b/i,
  // Location & Character
  /\b(left|right|upper|lower|abdomen|chest|head|throat|back|neck|arm|leg)\b/i,
  /\b(dull|sharp|cramping|burning|throbbing|mild|severe|constant|intermittent)\b/i,
  // Affirmation / Denial
  /\b(yes|no|none|never|not yet|already)\b/i,
]

function hasClinicalIntakeKeywords(text, lang) {
  const patterns = lang === 'en' ? CLINICAL_INTAKE_PATTERNS_EN : CLINICAL_INTAKE_PATTERNS_VI
  return patterns.some((pattern) => pattern.test(text))
}

/**
 * Checks whether the text contains any symptom-related keywords.
 * @param {string} text
 * @param {string} lang
 * @returns {boolean}
 */
function hasSymptomKeywords(text, lang) {
  const lower = text.toLowerCase()
  const keywords = lang === 'en' ? SYMPTOM_KEYWORDS_EN : SYMPTOM_KEYWORDS_VI
  return keywords.some((kw) => lower.includes(kw))
}

/**
 * Uses an LLM to classify the user's intent when the rule-based
 * approach is inconclusive.
 *
 * Returns:
 *  - 'symptom_query' if the user is describing/experiencing symptoms or clinical intake
 *  - 'refusal' for all other cases (definitions, off-topic, etc.)
 *
 * @param {string} text
 * @param {string} lang
 * @returns {Promise<'symptom_query' | 'refusal'>}
 */
async function llmClassify(text, lang) {
  if (!env.llmApiKey) {
    return 'symptom_query'
  }

  const isEn = lang === 'en'
  const systemPrompt = isEn
    ? `You are a medical intent classifier.
Classify the user message into exactly ONE category:
- SYMPTOM_QUERY: User describes, mentions, or denies symptoms, provides clinical intake info (age, sex, duration, location, medical history), or discusses health concerns. Examples: "I have a headache", "I don't have fever", "I am 22 years old male", "started yesterday", "lower right abdomen", "no vomiting"
- REFUSAL: Non-medical off-topic requests completely unrelated to health or consultation. Examples: "write a poem", "python code", "solve 2+2", "translate to french", "who is the president"

Output ONLY the category name, nothing else.`
    : `Bạn là bộ phân loại ý định y khoa.
Phân loại tin nhắn của người dùng thành ĐÚNG MỘT loại:
- SYMPTOM_QUERY: Người dùng mô tả, nhắc đến hoặc phủ nhận triệu chứng, cung cấp thông tin lâm sàng (tuổi, giới tính, thời gian, vị trí đau, tiền sử), hoặc hỏi đáp về sức khỏe. Ví dụ: "tôi bị đau đầu", "tôi không bị sốt", "tôi là nam 22 tuổi", "bị từ hôm qua", "ở bên phải bụng", "không nôn"
- REFUSAL: Yêu cầu ngoài lề hoàn toàn không liên quan đến y tế hay sức khỏe. Ví dụ: "viết bài thơ", "code python", "tính 2+2", "dịch sang tiếng anh", "ai là tổng thống"

Chỉ trả về tên loại, không thêm gì khác.`

  try {
    const result = await callLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      model: env.openrouterModelNer,
      stream: false,
      maxTokens: 10,
      timeoutMs: 8000,
    })

    const normalized = (result || '').trim().toUpperCase()
    return (
      normalized.includes('SYMPTOM') ||
      normalized.includes('TRIỆU CHỨNG') ||
      normalized.includes('TRIEU CHUNG') ||
      normalized.includes('Y TẾ') ||
      normalized.includes('SỨC KHỎE')
    ) ? 'symptom_query' : 'refusal'
  } catch {
    // When LLM classification fails (timeout, network, or API key issue),
    // default to symptom_query so the user's message is processed by the main
    // clinical pipeline rather than being rejected with a false refusal.
    return 'symptom_query'
  }
}

/**
 * Main entry point: classifies a user message into an IntentResult.
 *
 * Decision order:
 *  1. Quick patterns (greeting / thanks / farewell / bot identity) → type: 'quick'
 *  2. Symptom or clinical intake keywords present → type: 'symptom_query'
 *  3. In an ongoing consultation → type: 'symptom_query'
 *  4. LLM classifies the remainder
 *     - SYMPTOM_QUERY → symptom_query
 *     - anything else → refusal
 *
 * @param {string} text         - The last user message content
 * @param {string} lang         - 'vi' | 'en'
 * @param {Object} [options]
 * @param {boolean} [options.isOngoing=false] - Whether this message is part of an ongoing chat
 * @returns {Promise<IntentResult>}
 */
export async function detectIntent(text, lang = 'vi', options = {}) {
  if (!text || !text.trim()) {
    return { type: 'symptom_query', confidence: 1.0 }
  }

  const trimmed = text.trim()
  const { isOngoing = false } = options

  // 1. Quick-response patterns
  const subtype = classifyQuickSubtype(trimmed)
  if (subtype) {
    return { type: 'quick', subtype, confidence: 1.0 }
  }

  // 2. Symptom keyword or clinical intake heuristic — immediate SYMPTOM_QUERY
  if (hasSymptomKeywords(trimmed, lang) || hasClinicalIntakeKeywords(trimmed, lang)) {
    return { type: 'symptom_query', confidence: 0.85 }
  }

  // 3. Ongoing consultation context: user responses to assistant questions are clinical intake
  if (isOngoing) {
    return { type: 'symptom_query', confidence: 0.80 }
  }

  // 4. LLM classification for ambiguous cases
  const llmResult = await llmClassify(trimmed, lang)
  return { type: llmResult, confidence: 0.75 }
}

/**
 * Streams a quick reply and returns the full text.
 * @param {string} lang
 * @param {'greeting' | 'thanks' | 'farewell' | 'bot_identity'} subtype
 * @param {Function} onChunk
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function streamQuickReply(lang, subtype, onChunk, signal) {
  const key = `${subtype}_${lang}`
  const text = QUICK_REPLIES[key] || QUICK_REPLIES.greeting_vi
  return streamText(text, onChunk, signal, {
    thinkingDelayMs: 300,
    tokenDelayMs: 12,
  })
}

/**
 * Streams a refusal reply and returns the full text.
 * @param {string} lang
 * @param {Function} onChunk
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function streamRefusalReply(lang, onChunk, signal) {
  const text = lang === 'en' ? REFUSAL_REPLIES.en : REFUSAL_REPLIES.vi
  return streamText(text, onChunk, signal, {
    thinkingDelayMs: 300,
    tokenDelayMs: 12,
  })
}
