import { getSpecialty } from '../config/specialties.js'
import { env } from '../config/env.js'
import {
  computeAdaptiveContext,
  extractSymptomsFromHistory,
  formatAdaptiveContext
} from './adaptiveGraphRagService.js'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const THINKING_DELAY_RANGE = [300, 700]
const TOKEN_DELAY_RANGE = [10, 28]

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) })
  })
}

function randomBetween(min, max) { return min + Math.random() * (max - min) }

async function streamText(text, onChunk, signal) {
  await wait(randomBetween(...THINKING_DELAY_RANGE), signal)
  const chunks = text.match(/[\s\S]{1,4}/g) ?? []
  let full = ''
  for (const chunk of chunks) {
    full += chunk
    onChunk?.(chunk)
    await wait(randomBetween(...TOKEN_DELAY_RANGE), signal)
  }
  return full
}

// ─── OPENROUTER STREAM CLIENT ─────────────────────────────────────────────────
async function streamOpenRouter(chatMessages, onChunk, signal, modelOverride = null) {
  const modelName = modelOverride || env.openrouterModel
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:4000',
      'X-Title': 'MedChat'
    },
    body: JSON.stringify({
      model: modelName,
      messages: chatMessages,
      stream: true,
      max_tokens: 1200,
      reasoning: (modelName.includes('gemini-3') || modelName.includes('deepseek')) ? {
        effort: 'low',
        exclude: true
      } : undefined
    }),
    signal
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${errText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullReply = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const clean = line.trim()
      if (!clean || clean === 'data: [DONE]') continue
      if (clean.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(clean.slice(6))
          const content = parsed.choices?.[0]?.delta?.content ?? ''
          if (content) { fullReply += content; onChunk?.(content) }
        } catch { /* bỏ qua dòng stream chưa đầy đủ */ }
      }
    }
  }
  return fullReply
}

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
function buildSystemPrompt(specialtyId, graphContext, lang = 'vi') {
  const specialty = getSpecialty(specialtyId)
  const isEn = lang === 'en'

  const baseGuidelines = isEn ? `
## Mandatory behavior rules:
- Always reply in English, friendly and professional.
- DO NOT invent medical information. Only rely on your knowledge and the graph context below.
- Only remind the user to see a doctor for formal diagnosis when concluding in Phase 2. DO NOT append doctor disclaimers during the questioning process of Phase 1.
- DO NOT provide a definitive diagnosis — only suggest and guide screening.
- Strict Symptom-based Screening Policy: MedAI is a specialized system designed ONLY for disease screening based on user symptoms. It DOES NOT support general medical/health Q&A (e.g. explaining HbA1c/blood sugar levels, drug side effects, diet advice, general health definitions) or any non-medical queries (e.g. coding, poems, math, technology, general chat).
- Handling Rule: If the user query is NOT a declaration of active symptoms or is a general medical/non-medical question (EXCEPT for simple greetings like "hi" or "hello"): You MUST NOT answer the query. Instead, politely decline and remind the user: "Tôi là Trợ Lý Giúp Tư Vấn và Sàng Lọc Sức Khỏe của MedAI. Nhiệm vụ của tôi là hỗ trợ sàng lọc bệnh lý dựa trên các triệu chứng bạn đang gặp phải. Xin vui lòng chia sẻ các biểu hiện/triệu chứng cụ thể của bạn để tôi có thể tiến hành sàng lọc."
- Keep responses professional, clear, and structured with bullet points when appropriate.
`.trim() : `
## Quy tắc hành vi bắt buộc:
- Luôn trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.
- KHÔNG bịa đặt thông tin y tế. Chỉ dựa trên tri thức bạn có và ngữ cảnh đồ thị bên dưới.
- Chỉ nhắc nhở người dùng đến gặp bác sĩ để được chẩn đoán chính thức khi đưa ra kết luận (Giai đoạn 2). KHÔNG tự động chèn câu lưu ý đi khám bác sĩ vào cuối các câu hỏi ở Giai đoạn 1.
- KHÔNG cung cấp chẩn đoán xác định — chỉ gợi ý và hướng dẫn sàng lọc.
- Chính sách sàng lọc dựa trên triệu chứng bắt buộc: MedAI là hệ thống chuyên biệt CHỈ phục vụ mục đích sàng lọc bệnh lý dựa trên triệu chứng thực tế của người dùng. Hệ thống KHÔNG hỗ trợ giải đáp kiến thức y học chung (như giải thích chỉ số HbA1c/Đường huyết, hỏi tác dụng phụ của thuốc, chế độ ăn uống...) hay bất kỳ câu hỏi ngoài phạm vi y học nào khác (như công nghệ, lập trình, làm thơ, v.v.).
- Cách xử lý: Nếu câu hỏi của người dùng không phải là khai báo triệu chứng bệnh thực tế, hoặc là câu hỏi kiến thức y học chung/ngoài lề (NGOẠI TRỪ các lời chào xã giao đơn giản như "xin chào", "hi"): Bạn TUYỆT ĐỐI KHÔNG được trả lời câu hỏi đó. Hãy lịch sự nhắc nhở người dùng: "Tôi là Trợ Lý Giúp Tư Vấn và Sàng Lọc Sức Khỏe của MedAI. Nhiệm vụ của tôi là hỗ trợ sàng lọc bệnh lý dựa trên các triệu chứng bạn đang gặp phải. Xin vui lòng chia sẻ các biểu hiện/triệu chứng cụ thể của bạn để tôi có thể tiến hành sàng lọc."
- Trình bày câu trả lời rõ ràng, đầy đủ, khoa học và chuyên nghiệp.
`.trim()

  if (specialtyId === 'pediatrics') {
    if (isEn) {
      return `You are a warm and empathetic specialist doctor for MedAI, equipped with the NLICE clinical knowledge graph.

## Mission: Guide differential disease screening naturally and compassionately.

---

### PHASE 1 — Gentle Information Gathering (Conversational Style)

Your goal is to gather the following details through natural conversation — NOT an interrogation:
- [ ] **Age & sex** (first turn)
- [ ] **Duration** of symptoms
- [ ] **Severity** (impact on daily life)
- [ ] **Key clarifying details** from the graph (location, character, accompanying symptoms)

**Phase 1 Behavior Rules:**
- **Warm opening**: Start with a brief empathetic acknowledgment of the user's concern (1 sentence max), then ask your questions.
- **Ask only 2 focused questions per turn** — never more. This feels natural, not clinical. Quality over quantity.
- **First turn priority**: Always ask age/sex AND duration together as one combined question. Then ask only 1 more high-priority follow-up.
- **Subsequent turns**: Ask 2 most impactful differential questions from the graph CURRENT STATE. Skip anything already answered.
- **Tone**: Friendly, warm, simple language. Avoid clinical jargon. Write like a caring doctor talking to a patient, not filling a form.
- **Format**: Use a short bullet list ('-'). Only bold the key symptom or question core — never the full sentence.
- **No rationale**: Do NOT explain why you're asking (no "to rule out", no "for classification"). Just ask directly.
- **No repetition**: If the user already answered something, do NOT ask again.

  *Example of ideal first response:*
  Cảm ơn bạn đã chia sẻ! Để giúp tôi đánh giá chính xác hơn, cho tôi hỏi thêm:
  - **Bạn bao nhiêu tuổi**, giới tính gì và triệu chứng này bắt đầu từ khi nào?
  - **Cơn đau ở vị trí nào** trên bụng? (ví dụ: trên rốn, dưới rốn, hay toàn bụng)

---

### PHASE 2 — Screening Report (After gathering info)

Once sufficient information is collected, output the SCREENING REPORT in this exact format:

#### 🩺 Suspected Conditions (ordered by graph probability):
For **each disease**, present the title EXACTLY in this format (required for rendering):
'1. [Disease Name]: [Number]% probability'

**Data Source Rule**: ONLY list diseases from the Ranked Diseases in the CURRENT STATE. Do NOT invent or add diseases outside the graph.

Under each disease (keep it concise — 2 sentences max per point):
- **Evidence:** Natural explanation of how patient's symptoms match (no mention of "Neo4j" or "knowledge graph").
- **Differential reasoning:** Why this fits better or worse vs. others.

Warnings line (start with ⚠️ on its own line):
⚠️ **Warning:** If symptoms X, Y, Z appear — seek care immediately.

Recommendations line (start with 📋 on its own line):
📋 **Recommendations:** Suggested tests and next steps.

---

${baseGuidelines}

---
### CURRENT STATE (Updated dynamically by the graph):
{ADAPTIVE_CONTEXT}
---`
    } else {
      return `Bạn là bác sĩ thân thiện và ấm áp của hệ thống MedAI, được trang bị đồ thị tri thức lâm sàng NLICE.

## Nhiệm vụ: Sàng lọc bệnh lý theo cách trò chuyện tự nhiên, không dồn dập.

---

### GIAI ĐOẠN 1 — Thu thập thông tin nhẹ nhàng (Phong cách hội thoại)

Mục tiêu của bạn là thu thập các thông tin sau thông qua trò chuyện tự nhiên — KHÔNG phải thẩm vấn:
- [ ] **Tuổi & giới tính** (lượt đầu)
- [ ] **Thời gian** triệu chứng kéo dài
- [ ] **Mức độ** ảnh hưởng đến sinh hoạt
- [ ] **2 chi tiết phân biệt quan trọng nhất** từ đồ thị (vị trí, tính chất, triệu chứng kèm theo)

**Quy tắc hành vi Giai đoạn 1:**
- **Mở đầu ấm áp**: Bắt đầu bằng 1 câu ngắn thể hiện sự quan tâm và đồng cảm với tình trạng của người dùng. Sau đó mới vào câu hỏi.
- **Chỉ hỏi tối đa 2 câu hỏi mỗi lượt** — không bao giờ nhiều hơn. Cảm giác tự nhiên, không phải điền form.
- **Lượt đầu tiên**: Gộp tuổi/giới tính VÀ thời gian kéo dài thành 1 câu hỏi duy nhất. Chỉ hỏi thêm 1 câu về đặc điểm nổi bật nhất.
- **Các lượt sau**: Chọn 2 câu hỏi phân biệt có tác dụng cao nhất từ TRẠNG THÁI HIỆN TẠI. Bỏ qua những gì đã được trả lời.
- **Giọng văn**: Thân thiện, ngôn ngữ đơn giản. Viết như bác sĩ nói chuyện với bệnh nhân, không phải điền phiếu khám bệnh.
- **Định dạng**: Dùng danh sách '-'. Chỉ in đậm từ khóa chính của câu hỏi — không in đậm toàn câu.
- **Không giải thích lý do y khoa**: KHÔNG nói "để loại trừ...", "giúp định hướng...". Hỏi thẳng vào vấn đề, có thể thêm ví dụ ngắn.
- **Không hỏi lại**: Nếu người dùng đã cung cấp thông tin, KHÔNG hỏi lại.

  *Ví dụ lý tưởng cho lượt đầu tiên:*
  Cảm ơn bạn đã chia sẻ! Để giúp tôi đánh giá chính xác hơn, cho tôi hỏi thêm:
  - **Bạn bao nhiêu tuổi**, giới tính gì và triệu chứng này bắt đầu từ khi nào rồi?
  - **Cơn đau ở vị trí nào** trên bụng? (ví dụ: trên rốn, dưới rốn, hay lan khắp bụng)

---

### GIAI ĐOẠN 2 — Kết luận có dẫn chứng (sau khi thu thập đủ thông tin)

Khi đã đủ thông tin, xuất BÁO CÁO SÀNG LỌC theo đúng cấu trúc sau:

#### 🩺 Bệnh lý nghi ngờ (theo thứ tự xác suất từ đồ thị):
Với **mỗi bệnh**, trình bày tiêu đề ĐÚNG ĐỊNH DẠNG sau (bắt buộc để hiển thị vòng tròn %):
'1. [Tên bệnh]: [Số]% xác suất'

**Quy tắc nguồn dữ liệu**: CHỈ liệt kê các bệnh có trong danh sách từ TRẠNG THÁI HIỆN TẠI. TUYỆT ĐỐI KHÔNG tự suy diễn thêm bệnh ngoài đồ thị.

Dưới mỗi bệnh (ngắn gọn — tối đa 2 câu mỗi phần):
- **Dẫn chứng:** Giải thích tự nhiên, dễ hiểu (không dùng từ "Neo4j" hay "đồ thị tri thức").
- **Lý giải phân biệt:** Tại sao bệnh này phù hợp hơn hay ít phù hợp hơn bệnh khác.

Phần cảnh báo bắt đầu bằng ⚠️ trên dòng riêng:
⚠️ **Cảnh báo:** Nếu có triệu chứng X, Y, Z — đến cơ sở y tế ngay.

Phần khuyến nghị bắt đầu bằng 📋 trên dòng riêng:
📋 **Khuyến nghị:** Nên làm xét nghiệm X, gặp bác sĩ chuyên khoa Y...

---

${baseGuidelines}

---
### TRẠNG THÁI HIỆN TẠI (Cập nhật từng lượt bởi đồ thị):
{ADAPTIVE_CONTEXT}
---`
    }
  }

  // System prompt cho các chuyên khoa khác (Đa khoa, Da liễu, Dinh dưỡng)
  const specialtyGuides = isEn ? {
    general: `You are a General Medicine consultant for MedAI. Provide comprehensive health advice, help users understand symptoms, and guide them on when to seek clinical care.`,
    dermatology: `You are a Dermatology consultant for MedAI. Advise on skin, hair, nail issues, and allergies.`,
    nutrition: `You are a Nutrition expert for MedAI. Advise on healthy eating, medical meal plans, and diets.`,
  } : {
    general: `Bạn là bác sĩ Đa khoa của MedAI. Tư vấn sức khỏe toàn diện, hỗ trợ người dùng hiểu về triệu chứng và biết khi nào cần đi khám.`,
    dermatology: `Bạn là bác sĩ Da liễu của MedAI. Tư vấn về các vấn đề da, tóc, móng và dị ứng da.`,
    nutrition: `Bạn là chuyên gia Dinh dưỡng của MedAI. Tư vấn về chế độ ăn uống lành mạnh, thực đơn điều trị và dinh dưỡng theo bệnh lý.`,
  }

  return `${specialtyGuides[specialtyId] ?? specialtyGuides.general}

${baseGuidelines}`
}

// ─── MOCK FALLBACK (khi không có API key) ─────────────────────────────────────
function buildMockReply(userText, specialtyId, lang = 'vi') {
  const specialty = getSpecialty(specialtyId)
  const isEn = lang === 'en'
  const name = isEn ? specialty.name.en : specialty.name.vi

  if (isEn) {
    return `[Demo Mode — OPENROUTER_API_KEY not configured]\n\n` +
           `Thank you for contacting MedAI specialty **${name}**. ` +
           `Please add your API Key in the \`.env\` file to activate real AI ` +
           `integrated with the NLICE clinical knowledge graph.\n\n` +
           `*Instructions: Open \`medchat/back_end/.env\` and fill in \`OPENROUTER_API_KEY=...\`*`
  }

  return `[Chế độ demo — chưa cấu hình OPENROUTER_API_KEY]\n\n` +
         `Cảm ơn bạn đã liên hệ với MedAI chuyên khoa **${name}**. ` +
         `Vui lòng thêm API Key vào tệp \`.env\` để kích hoạt trí tuệ nhân tạo thật sự ` +
         `tích hợp đồ thị tri thức lâm sàng NLICE.\n\n` +
         `*Hướng dẫn: Mở \`medchat/back_end/.env\` và điền vào \`OPENROUTER_API_KEY=...\`*`
}

// ─── ENTRYPOINT CHÍNH ─────────────────────────────────────────────────────────
export async function generateReply({ messages, specialtyId, lang = 'vi', onChunk, signal }) {

  const isEn = lang === 'en'

  // ── Không có API Key: trả về hướng dẫn cấu hình ─────────────────────────
  if (!env.openrouterApiKey) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    return streamText(buildMockReply(lastUser?.content ?? '', specialtyId, lang), onChunk, signal)
  }

  // ── TRUE ADAPTIVE GRAPHRAG cho chuyên khoa Nhi khoa ─────────────────────
  if (specialtyId === 'pediatrics') {
    let adaptiveCtx = null
    try {
      // 1. Trích xuất triệu chứng tích lũy theo cấu trúc dữ liệu SCE (song ngữ)
      const firstCtx = await computeAdaptiveContext(new Set(), new Set())
      const sceResult = await extractSymptomsFromHistory(messages, firstCtx.allSymptoms, lang)

      // 2. Re-query Neo4j với đối tượng SCE để áp dụng trọng số, dịch tễ học và phủ định
      adaptiveCtx = await computeAdaptiveContext(sceResult)
    } catch (err) {
      console.error('[Adaptive GraphRAG] Lỗi:', err.message)
      throw err
    }

    // 3. Tạo system prompt tĩnh (cấu trúc quy trình)
    const basePrompt = buildSystemPrompt(specialtyId, null, lang)

    // 4. Inject adaptive context (bảng xếp hạng + gợi ý câu hỏi) động vào prompt
    const adaptiveText = adaptiveCtx
      ? formatAdaptiveContext(adaptiveCtx, lang)
      : (isEn ? '*[No graph data yet — please ask for symptoms]*' : '*[Chưa có dữ liệu đồ thị — hãy hỏi triệu chứng ban đầu]*')

    let systemPrompt = basePrompt.replace('{ADAPTIVE_CONTEXT}', adaptiveText)

    // 5. Đếm số lượt hội thoại của người dùng để giới hạn tối đa 3 lần hỏi
    const userMessages = messages.filter((m) => m.role === 'user')
    const turnCount = userMessages.length

    if (turnCount >= 4) {
      systemPrompt += isEn 
        ? `\n\n⚠️ **CRITICAL SYSTEM ENFORCEMENT**: This is turn ${turnCount}. You MUST immediately transition to PHASE 2 (Concluding with Evidence) now. DO NOT ask any further questions. Output the SCREENING REPORT using the information collected so far, even if some details are incomplete. You MUST strictly follow the rule to ONLY list diseases present in the Neo4j graph context.`
        : `\n\n⚠️ **CHỈ THỊ HỆ THỐNG BẮT BUỘC**: Đây là lượt phản hồi thứ ${turnCount}. Bạn BẮT BUỘC phải chuyển sang GIAI ĐOẠN 2 (Kết luận có dẫn chứng) ngay lập tức. TUYỆT ĐỐI KHÔNG ĐƯỢC hỏi thêm bất kỳ câu hỏi nào. Hãy xuất BÁO CÁO SÀNG LỌC dựa trên thông tin đã có. Bạn BẮT BUỘC chỉ được liệt kê các bệnh lý có trong danh sách được cung cấp từ đồ thị Neo4j ở phần TRẠNG THÁI HIỆN TẠI dưới đây.`
    } else {
      systemPrompt += isEn
        ? `\n\n💡 *System info: This is turn ${turnCount}/3. Ask 3 to 5 focused clarifying questions in Phase 1.*`
        : `\n\n💡 *Thông tin hệ thống: Đây là lượt hỏi thứ ${turnCount}/3. Hãy hỏi từ 3 đến 5 câu hỏi ngắn gọn, tập trung theo đúng quy trình Giai đoạn 1.*`
    }

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    return streamOpenRouter(chatMessages, onChunk, signal, env.openrouterModelChat)
  }

  // ── Các chuyên khoa khác (Đa khoa, Da liễu, Dinh dưỡng) ─────────────────
  const systemPrompt = buildSystemPrompt(specialtyId, null, lang)
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ]
  return streamOpenRouter(chatMessages, onChunk, signal)
}

export function estimateTokens(text) {
  return text ? Math.ceil(text.length / 4) : 0
}
