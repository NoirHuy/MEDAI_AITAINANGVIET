import { env } from '../../config/env.js'
import { auditLog } from '../../utils/auditLog.js'
import { callLLM } from '../llm/llmClient.js'

// ─── DYNAMIC AI SMART TITLE GENERATION (CHATGPT STYLE) ────────────────────────
export async function generateSmartTitle(userText, lang = 'vi') {
  if (!userText || typeof userText !== 'string') return 'Cuộc trò chuyện mới'

  const cleanInput = userText.trim().replace(/\[.*?\]/g, '').replace(/[*_`]/g, '')
  if (!cleanInput) return 'Cuộc trò chuyện mới'

  // 1. GỬI TRỰC TIẾP CHO LLM TẠO TIÊU ĐỀ SÚC TÍCH (ƯU TIÊN HÀNG ĐẦU)
  if (env.llmApiKey) {
    try {
      const rawTitle = await callLLM({
        messages: [
          {
            role: 'system',
            content: `Bạn là chuyên gia tạo tiêu đề súc tích cho đoạn chat (tương tự ChatGPT).
Hãy tóm tắt ý chính của lời nhắn người dùng thành đúng 1 tiêu đề ngắn gồm 2 đến 4 từ tiếng Việt.

QUY TẮC BẮT BUỘC:
- Lời nhắn chào hỏi ("hello", "hi", "chào bác sĩ") -> Đặt tên: "Lời chào ban đầu" hoặc "Chào hỏi & Bắt đầu".
- Lời nhắn về tuổi/hành chính ("tôi 22 tuổi") -> Đặt tên: "Tư vấn tuổi & sức khỏe".
- Lời nhắn chứa triệu chứng -> Đặt tên dạng "Tư vấn + triệu chứng" hoặc "Đánh giá + triệu chứng" (Ví dụ: "Tư vấn sốt & đau họng", "Đánh giá đau bụng cấp", "Tư vấn mẩn ngứa da"). KHÔNG dùng từ "Chẩn đoán".
- Lời nhắn về chủ đề khác -> Đặt tên chủ đề ngắn gọn (Ví dụ: "Hướng dẫn thanh toán", "Hỏi đáp thuốc hạ sốt").
- KHÔNG BAO GIỜ đặt tên là "Cuộc trò chuyện mới".
- CHỈ TRẢ VỀ DUY NHẤT CỤM TỪ TIÊU ĐỀ, KHÔNG THÊM CẶP NGOẶC HAY TỪ DẪN.`
          },
          { role: 'user', content: cleanInput }
        ],
        model: env.openrouterModel,
        stream: false,
        maxTokens: 25,
        timeoutMs: 15000
      })

      let title = rawTitle?.trim()?.replace(/^["'«»“`]+|["'«»”`]+$/g, '')
      if (title) {
        title = title.replace(/^chẩn đoán/i, 'Tư vấn').replace(/^dự đoán/i, 'Sàng lọc')
        if (title.length >= 2 && title.length <= 40) {
          return title
        }
      }
    } catch (err) {
      auditLog('SmartTitle', 'Error', `Error calling LLM for title: ${err.message}`, 'warn')
    }
  }

  // 2. FALLBACK HEURISTIC KHI KHÔNG CÓ KẾT NỐI API HOẶC XẢY RA LỖI
  const lower = cleanInput.toLowerCase()
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('chào')) {
    return lang === 'en' ? 'Initial Greeting' : 'Lời chào ban đầu'
  }
  if ((lower.includes('đau họng') || lower.includes('amidan') || lower.includes('rát họng')) && lower.includes('sốt')) {
    return lang === 'en' ? 'Sore Throat & Fever' : 'Tư vấn sốt & đau họng'
  }
  if (lower.includes('amidan') || lower.includes('đau họng') || lower.includes('rát họng')) {
    return lang === 'en' ? 'Sore Throat Symptoms' : 'Tư vấn đau rát họng'
  }
  if (lower.includes('đau bụng') && (lower.includes('hố chậu') || lower.includes('ruột thừa'))) {
    return lang === 'en' ? 'Acute Abdominal Pain' : 'Đánh giá đau bụng cấp'
  }
  if (lower.includes('đau bụng') || lower.includes('dạ dày')) {
    return lang === 'en' ? 'Abdominal Pain Symptoms' : 'Tư vấn triệu chứng đau bụng'
  }
  if (lower.includes('đau đầu') || lower.includes('thái dương') || lower.includes('migraine')) {
    return lang === 'en' ? 'Headache Symptoms' : 'Tư vấn triệu chứng đau đầu'
  }
  if (lower.includes('sốt')) {
    return lang === 'en' ? 'Fever Symptoms' : 'Tư vấn triệu chứng sốt'
  }

  const words = cleanInput.split(/\s+/).slice(0, 4).join(' ')
  return words.length <= 25 ? words : `${words.slice(0, 22)}…`
}
