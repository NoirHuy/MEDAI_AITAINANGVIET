import neo4j from 'neo4j-driver'
import { env } from '../config/env.js'

// ─── NEO4J DRIVER ────────────────────────────────────────────────────────────
const driver = neo4j.driver(
  env.neo4jUri,
  neo4j.auth.basic(env.neo4jUsername, env.neo4jPassword)
)

// ─── CACHE ───────────────────────────────────────────────────────────────────
let _cachedSymptomNames = null
let _cachedSymptoms = null
let _cachedDiseaseOverview = null

async function getAllSymptoms(session) {
  if (_cachedSymptoms) return _cachedSymptoms
  const res = await session.run('MATCH (s:Symptom) RETURN s.id AS id, s.name AS name, s.cui AS cui ORDER BY s.name')
  _cachedSymptoms = res.records.map(r => ({
    id: r.get('id'),
    name: r.get('name'),
    cui: r.get('cui') || null
  }))
  return _cachedSymptoms
}

async function getAllSymptomNames(session) {
  if (_cachedSymptomNames) return _cachedSymptomNames
  const symptoms = await getAllSymptoms(session)
  _cachedSymptomNames = symptoms.map(s => s.name)
  return _cachedSymptomNames
}

async function getDiseaseOverview(session) {
  if (_cachedDiseaseOverview) return _cachedDiseaseOverview
  const res = await session.run(`
    MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
    WITH d, collect({symptom: s.name, prob: r.probability, description: s.description}) AS symptoms
    OPTIONAL MATCH (d)-[ra:AFFECTS_AGE]->(a:AgeGroup)
    WITH d, symptoms, collect(DISTINCT {age: a.name, prob: ra.probability}) AS ages
    OPTIONAL MATCH (d)-[rg:AFFECTS_SEX]->(g:Sex)
    WITH d, symptoms, ages, collect(DISTINCT {sex: g.name, prob: rg.probability}) AS sexes
    RETURN d.name AS disease, d.description AS description, d.remarks AS remarks, symptoms, ages, sexes
    ORDER BY d.name
  `)
  _cachedDiseaseOverview = res.records.map(r => ({
    name: r.get('disease'),
    description: r.get('description') || '',
    remarks: r.get('remarks') || '',
    symptoms: r.get('symptoms').map(s => ({
      symptom: s.symptom,
      prob: s.prob,
      description: s.description || ''
    })).sort((a, b) => b.prob - a.prob).slice(0, 6),
    ages: r.get('ages').filter(a => a.age && a.prob).sort((a, b) => b.prob - a.prob).slice(0, 2),
    sexes: r.get('sexes').filter(s => s.sex && s.prob)
  }))
  return _cachedDiseaseOverview
}

// ─── UMLS API CONNECTOR ──────────────────────────────────────────────────────
async function searchUMLS(queryString) {
  if (!env.umlsApiKey) {
    console.log('[UMLS] No UMLS_API_KEY config. Skipping UMLS search.')
    return []
  }
  try {
    const url = `https://uts-ws.nlm.nih.gov/rest/search/current?string=${encodeURIComponent(queryString)}&apiKey=${env.umlsApiKey}`
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      throw new Error(`Dịch vụ UMLS trả về lỗi ${response.status}`)
    }
    const data = await response.json()
    return data.result?.results || []
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('aborted')
    throw new Error(isTimeout ? "Dịch vụ UMLS không phản hồi (Timeout 8s)" : `Mất kết nối UMLS: ${err.message}`)
  }
}

// Helper phụ thực thi cuộc gọi OpenRouter cụ thể
async function tryCallOpenRouter(chatMessages, modelName, timeoutMs = 15000) {
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
      temperature: 0.1,
      max_tokens: 3000 // Tăng lên 3000 để chứa đủ cả reasoning và JSON content
    }),
    signal: AbortSignal.timeout(timeoutMs)
  })

  if (!response.ok) {
    throw new Error(`OpenRouter trả về lỗi ${response.status}`)
  }
  const data = await response.json()
  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`)
  }
  const content = data.choices?.[0]?.message?.content
  if (content === undefined || content === null) {
    console.warn('[Audit Log][LLM_TRANSLATION][Warning] Empty choices content from OpenRouter:', JSON.stringify(data))
  }
  return content ?? ""
}

// Helper gọi OpenRouter Completion chính hỗ trợ chuyển đổi phòng thủ (Active Failover)
async function callOpenRouter(chatMessages) {
  if (!env.openrouterApiKey) return ""
  
  const primaryModel = env.openrouterModel
  const fallbackModel = 'qwen/qwen3.5-flash-02-23'

  try {
    console.log(`[Audit Log][LLM_TRANSLATION][Info] Calling primary model: "${primaryModel}"`)
    return await tryCallOpenRouter(chatMessages, primaryModel, 25000) // Tăng thời gian chờ lên 25s cho model chính để suy nghĩ sâu
  } catch (err) {
    // Nếu model chính lỗi hoặc timeout, tự động failover sang Qwen
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('aborted') || err.message?.includes('Timeout')
    console.warn(`[Audit Log][LLM_TRANSLATION][Warning] Primary model "${primaryModel}" failed (${isTimeout ? 'Timeout' : err.message}). Retrying with defensive fallback model "${fallbackModel}"...`)
    
    try {
      return await tryCallOpenRouter(chatMessages, fallbackModel, 15000) // Tăng thời gian chờ lên 15s cho model phòng ngự
    } catch (fallbackErr) {
      console.error(`[Audit Log][LLM_TRANSLATION][Error] Fallback model "${fallbackModel}" also failed:`, fallbackErr.message)
      throw new Error(`Cả model chính và phòng thủ đều lỗi. Model chính: ${err.message}. Model phòng thủ: ${fallbackErr.message}`)
    }
  }
}

// ─── UMLS + LLM SEMANTIC SYMPTOM EXTRACTION ──────────────────────────────────
export async function extractSymptomsFromHistory(messages, symptomsList, lang = 'vi') {
  const emptySCE = {
    demographics: { age: null, sex: null },
    temporal: { durationValue: null, durationUnit: null, onset: null },
    symptoms: []
  }

  if (!messages || messages.length === 0) return emptySCE

  const isEn = lang === 'en'

  // Tạo hội thoại phân vai đầy đủ (Bác sĩ & Bệnh nhân) để giữ vững ngữ cảnh lâm sàng
  const formattedHistory = messages
    .map(m => `${m.role === 'user' ? (isEn ? 'Patient' : 'Bệnh nhân') : (isEn ? 'Doctor' : 'Bác sĩ')}: ${m.content}`)
    .join('\n')

  // BƯỚC 1: LLM dịch mô tả sang định dạng JSON Structured Clinical Extraction (SCE) song ngữ
  const translationPrompt = isEn ? `You are a professional medical assistant and a clinical entity extraction expert (Clinical NER).
Analyze the conversation history between the Doctor and the Patient below to extract structured clinical information in Structured Clinical Extraction (SCE) format.

Output Format:
You MUST return ONLY a single valid JSON block matching the following structure (Do not add any markdown comments, reasoning text, or extra characters outside of this JSON):

{
  "demographics": {
    "age": <patient's age as a number, e.g. 22, or null if not mentioned>,
    "sex": <"male" | "female" | null>
  },
  "temporal": {
    "durationValue": <number representing symptom duration, e.g. 2, or null>,
    "durationUnit": <"hours" | "days" | "weeks" | "months" | null>,
    "onset": <"acute" (e.g. hours/days) | "subacute" | "chronic" (e.g. weeks/months) | null>
  },
  "symptoms": [
    {
      "term": "<atomic clinical symptom term in English, e.g. 'Headache', 'Nausea'>",
      "status": "<'positive' if the patient confirms this symptom | 'negative' if the patient denies this symptom>",
      "role": "<'chief_complaint' if this is the primary reason for the medical visit | 'associated' if it is a secondary symptom>",
      "confidenceScore": <your extraction confidence score from 0.0 to 1.0>,
      "attributes": {
        "severity": "<'mild' | 'moderate' | 'severe' | null>",
        "frequency": "<'constant' | 'episodic' | null>",
        "progression": "<'improving' | 'stable' | 'worsening' | null>",
        "bodyLocation": "<specific anatomical location, e.g. 'occipital region', 'epigastrium', or null>"
      }
    }
  ]
}

Mandatory Clinical NLP Rules:
1. Atomic Representation & No Disease Inference: Only extract symptoms at an atomic level. For example, "back of head pain" -> term "Headache" or "Occipital headache", bodyLocation "occipital region". Do NOT infer clinical diseases (e.g. do not output Tension headache, as disease classification belongs to the graph reasoning layer).
2. Negation Detection: Extract negated symptoms mentioned by the patient. If the patient says "no vomiting", output term: "Vomiting", status: "negative".
3. Hybrid Chief Complaint: The first symptom reported by the Patient in their first turn is the highest priority candidate. Verify if it is indeed the main reason for visit to set role: "chief_complaint". Mark subsequent symptoms as "associated".

Clinical Conversation:
${formattedHistory}

JSON Output:` : `Bạn là trợ lý y khoa chuyên nghiệp và là chuyên gia trích xuất thực thể (Clinical NER).
Hãy phân tích toàn bộ cuộc hội thoại giữa Bác sĩ (Doctor) và Bệnh nhân (Patient) dưới đây để trích xuất thông tin lâm sàng chuẩn hóa theo mô hình Structured Clinical Extraction (SCE).

Yêu cầu định dạng đầu ra:
Bạn CHỈ được phép trả về duy nhất một khối JSON hợp lệ theo cấu trúc mẫu sau (Không viết thêm bất kỳ văn bản giải thích hay ký tự nào khác bên ngoài khối JSON này):

{
  "demographics": {
    "age": <số tuổi của bệnh nhân, ví dụ: 22, hoặc null nếu không nhắc tới>,
    "sex": <"male" | "female" | null>
  },
  "temporal": {
    "durationValue": <số thời gian kéo dài triệu chứng, ví dụ: 2, hoặc null>,
    "durationUnit": <"hours" | "days" | "weeks" | "months" | null>,
    "onset": <"acute" (cấp tính, ví dụ: vài giờ/vài ngày) | "subacute" (bán cấp) | "chronic" (mãn tính, vài tuần/vài tháng) | null>
  },
  "symptoms": [
    {
      "term": "<tên triệu chứng lâm sàng bằng tiếng Anh nguyên tử, ví dụ: 'Headache', 'Nausea'>",
      "status": "<'positive' nếu bệnh nhân xác nhận có triệu chứng này | 'negative' nếu bệnh nhân phủ nhận triệu chứng này>",
      "role": "<'chief_complaint' nếu đây là triệu chứng chính/lý do khám y khoa chính | 'associated' nếu đây là triệu chứng đi kèm>",
      "confidenceScore": <mức độ tự tin (confidence score) của bạn về việc trích xuất thực thể này từ 0.0 đến 1.0>,
      "attributes": {
        "severity": "<'mild' | 'moderate' | 'severe' | null>",
        "frequency": "<'constant' | 'episodic' | null>",
        "progression": "<'improving' | 'stable' | 'worsening' | null>",
        "bodyLocation": "<vị trí giải phẫu cụ thể, ví dụ: 'occipital region', 'epigastrium', hoặc null>"
      }
    }
  ]
}

Nguyên tắc lâm sàng bắt buộc (Clinical NLP Rules):
1. Tách biệt trích xuất và suy luận: Bạn chỉ trích xuất triệu chứng ở mức nguyên tử (atomic representation). Ví dụ: "đau đầu sau gáy" -> term là "Headache" hoặc "Occipital headache", bodyLocation là "occipital region". TUYỆT ĐỐI không tự suy diễn bệnh lý (ví dụ: cấm quy đổi thành Tension headache, vì chẩn đoán bệnh là của tầng suy luận đồ thị).
2. Phủ định (Negation): Phải trích xuất đầy đủ triệu chứng phủ định. Nếu bệnh nhân nói "không nôn, không buồn nôn", bạn phải ghi nhận term: "Nausea" và "Vomiting" với status: "negative".
3. Xác định Chief Complaint lai: Triệu chứng đầu tiên mà Bệnh nhân khai báo trong lượt thoại đầu tiên là ứng viên ưu tiên cao nhất làm Chief Complaint. Bạn hãy kiểm tra xem đó có đúng là lý do chính khiến bệnh nhân đi khám không để gán role: "chief_complaint". Tất cả các triệu chứng phụ phát hiện sau đó gán role: "associated".

Hội thoại lâm sàng:
${formattedHistory}

Kết quả JSON:`

  let rawTranslation = ""
  try {
    rawTranslation = await callOpenRouter([
      { role: 'system', content: isEn ? 'You are a medical extraction robot that only returns valid JSON.' : 'Bạn là robot trích xuất y khoa chỉ trả về định dạng JSON hợp lệ.' },
      { role: 'user', content: translationPrompt }
    ])
  } catch (err) {
    console.error('[Audit Log][LLM_TRANSLATION][Error] OpenRouter connection failed:', err.message)
    throw err
  }

  // Audit Log Layer: LLM Output
  console.log('[Audit Log][LLM_TRANSLATION][Raw] LLM Output:', rawTranslation)

  let extractedPayload = null
  try {
    let cleanJson = rawTranslation.replace(/```json/g, '').replace(/```/g, '').trim()
    // Loại bỏ single-line comments (ví dụ: // comment)
    cleanJson = cleanJson.replace(/\/\/.*$/gm, '')
    // Loại bỏ dấu phẩy thừa trước dấu đóng ngoặc (trailing commas)
    cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1')
    
    extractedPayload = JSON.parse(cleanJson)
    console.log('[Audit Log][LLM_TRANSLATION][Success] Parsed SCE JSON successfully.')
  } catch (err) {
    console.error('[Audit Log][LLM_TRANSLATION][Error] JSON parsing failed:', err.message)
    return emptySCE
  }

  const finalSymptoms = []
  const unmatchedTerms = []

  // BƯỚC 2: Duyệt qua triệu chứng để tìm mã CUI UMLS y khoa
  const extractedSymptoms = extractedPayload.symptoms || []
  for (const sym of extractedSymptoms) {
    console.log(`[Audit Log][UMLS_SEARCH][Start] Querying UMLS for term: "${sym.term}"`)
    let umlsCui = null
    let umlsName = null

    try {
      const results = await searchUMLS(sym.term)
      if (results && results.length > 0) {
        umlsCui = results[0].ui
        umlsName = results[0].name
        console.log(`[Audit Log][UMLS_SEARCH][Success] Term: "${sym.term}" -> Match: "${umlsName}" (CUI: ${umlsCui})`)
      } else {
        console.log(`[Audit Log][UMLS_SEARCH][Warning] No UMLS results for term: "${sym.term}"`)
      }
    } catch (err) {
      console.error(`[Audit Log][UMLS_SEARCH][Error] UMLS search failed for "${sym.term}":`, err.message)
      throw err
    }

    // Kiểm tra ngưỡng tự tin trích xuất của mô hình (Confidence Score)
    if (sym.confidenceScore < env.confidenceThreshold) {
      console.warn(`[Audit Log][LLM_TRANSLATION][Warning] Low extraction confidence (${sym.confidenceScore}) for term: "${sym.term}"`)
    }

    // BƯỚC 3: So khớp triệu chứng vào danh sách từ Neo4j
    const cuiToIdMap = new Map()
    const nameToIdMap = new Map()
    const idToIdMap = new Map()

    for (const s of symptomsList) {
      if (s.cui) {
        cuiToIdMap.set(s.cui.toLowerCase(), s.id)
      }
      nameToIdMap.set(s.name.toLowerCase(), s.id)
      idToIdMap.set(s.id.toLowerCase(), s.id)
    }

    let matchedSymptomId = null

    // 3a. Ưu tiên 1: So khớp bằng CUI
    if (umlsCui && cuiToIdMap.has(umlsCui.toLowerCase())) {
      matchedSymptomId = cuiToIdMap.get(umlsCui.toLowerCase())
      console.log(`[Audit Log][NEO4J_QUERY][Success] CUI Match: "${sym.term}" -> mapped via CUI ${umlsCui} to Neo4j Symptom: "${matchedSymptomId}"`)
    }
    // 3b. Ưu tiên 2: So khớp bằng tên gốc hoặc slug thô
    else {
      const termLower = sym.term.toLowerCase()
      const cleanTerm = termLower.replace(/_/g, '-').replace(/\s+/g, '-')

      if (nameToIdMap.has(termLower)) {
        matchedSymptomId = nameToIdMap.get(termLower)
        console.log(`[Audit Log][NEO4J_QUERY][Success] Text Match: "${sym.term}" -> mapped via exact name to Neo4j Symptom: "${matchedSymptomId}"`)
      } else if (idToIdMap.has(cleanTerm)) {
        matchedSymptomId = idToIdMap.get(cleanTerm)
        console.log(`[Audit Log][NEO4J_QUERY][Success] Text Match: "${sym.term}" -> mapped via clean slug to Neo4j Symptom: "${matchedSymptomId}"`)
      } else if (umlsName && nameToIdMap.has(umlsName.toLowerCase())) {
        matchedSymptomId = nameToIdMap.get(umlsName.toLowerCase())
        console.log(`[Audit Log][NEO4J_QUERY][Success] Text Match: "${sym.term}" -> mapped via UMLS name "${umlsName}" to Neo4j Symptom: "${matchedSymptomId}"`)
      }
    }

    if (matchedSymptomId) {
      const matchedNode = symptomsList.find(s => s.id === matchedSymptomId)
      finalSymptoms.push({
        symptomId: matchedSymptomId,
        name: matchedNode ? matchedNode.name : sym.term,
        cui: umlsCui,
        status: sym.status || 'positive',
        role: sym.role || 'associated',
        confidenceScore: sym.confidenceScore || 1.0,
        attributes: sym.attributes || { severity: null, frequency: null, progression: null, bodyLocation: null }
      })
    } else {
      unmatchedTerms.push({ ...sym, umlsCui, umlsName })
    }
  }

  // BƯỚC 4: Fallback LLM Match (cho các triệu chứng không có CUI/Text khớp trực tiếp)
  if (unmatchedTerms.length > 0) {
    console.log(`[Audit Log][LLM_TRANSLATION][Fallback] Triggering LLM Fallback for ${unmatchedTerms.length} unmatched terms.`)
    const unmatchedDetails = unmatchedTerms.map(u => 
      u.umlsCui ? `Term: "${u.term}" (UMLS Name: "${u.umlsName}", CUI: ${u.umlsCui})` : `Term: "${u.term}" (No UMLS CUI)`
    ).join('\n')

    const availableSlugs = symptomsList.map(s => s.id)

    const verificationPrompt = `Bạn là hệ thống ánh xạ thực thể y học lâm sàng. 
Nhiệm vụ: Dựa trên các triệu chứng chưa khớp được và kết quả UMLS dưới đây, hãy lựa chọn các slug triệu chứng phù hợp nhất từ danh sách cơ sở dữ liệu SymCAT.

Các triệu chứng chưa khớp:
${unmatchedDetails}

Danh sách các slug SymCAT được phép chọn (Chọn đúng slug trong danh sách dưới đây, ngăn cách bằng dấu phẩy. Không tự ý bịa slug khác):
${availableSlugs.slice(0, 300).join(', ')}
${availableSlugs.slice(300).join(', ')}

Chỉ trả về danh sách các slug khớp chính xác nhất từ danh sách trên (ví dụ: "cough, back-pain"). Nếu không có triệu chứng nào khớp, trả về "none".`

    try {
      const verifiedRaw = await callOpenRouter([
        { role: 'system', content: 'Bạn là chuyên viên chuẩn hóa y khoa. Chỉ trả về danh sách các slug hợp lệ ngăn cách bằng dấu phẩy.' },
        { role: 'user', content: verificationPrompt }
      ])

      if (verifiedRaw && !verifiedRaw.toLowerCase().includes('none')) {
        const verifiedSlugs = verifiedRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        console.log(`[Audit Log][LLM_TRANSLATION][Fallback] Mapped slugs:`, verifiedSlugs)
        
        verifiedSlugs.forEach(slug => {
          const matchedSymptom = symptomsList.find(s => s.id.toLowerCase() === slug)
          if (matchedSymptom) {
            const originalItem = unmatchedTerms.find(u => u.term.toLowerCase() === slug.replace(/-/g, ' ') || u.term.toLowerCase() === slug) || {}
            if (!finalSymptoms.some(s => s.symptomId === matchedSymptom.id)) {
              finalSymptoms.push({
                symptomId: matchedSymptom.id,
                name: matchedSymptom.name,
                cui: matchedSymptom.cui,
                status: originalItem.status || 'positive',
                role: originalItem.role || 'associated',
                confidenceScore: originalItem.confidenceScore || 0.8,
                attributes: originalItem.attributes || { severity: null, frequency: null, progression: null, bodyLocation: null }
              })
            }
          }
        })
      }
    } catch (err) {
      console.error(`[Audit Log][LLM_TRANSLATION][Error] Fallback LLM mapping failed:`, err.message)
      throw err
    }
  }

  // Quy tắc Chief Complaint lai (Hybrid CC Rule) để đảm bảo độ chính xác
  let hasChiefComplaint = finalSymptoms.some(s => s.role === 'chief_complaint' && s.status === 'positive')
  if (!hasChiefComplaint && finalSymptoms.length > 0) {
    const firstPositive = finalSymptoms.find(s => s.status === 'positive')
    if (firstPositive) {
      firstPositive.role = 'chief_complaint'
      console.log(`[Audit Log][BAYESIAN_REASONING][Rule] Hybrid CC Rule: Promoted "${firstPositive.symptomId}" to chief_complaint.`)
    }
  }

  return {
    demographics: extractedPayload.demographics || { age: null, sex: null },
    temporal: extractedPayload.temporal || { durationValue: null, durationUnit: null, onset: null },
    symptoms: finalSymptoms
  }
}

// Helper phân loại nhóm tuổi tương thích cấu trúc CDC trong Neo4j
function findAgeGroup(age, ages) {
  if (age === null || age === undefined) return null
  let targetSlug = ''
  if (age < 1) targetSlug = 'age-1-years'
  else if (age <= 4) targetSlug = 'age-1-4-years'
  else if (age <= 14) targetSlug = 'age-5-14-years'
  else if (age <= 29) targetSlug = 'age-15-29-years'
  else if (age <= 44) targetSlug = 'age-30-44-years'
  else if (age <= 59) targetSlug = 'age-45-59-years'
  else if (age <= 74) targetSlug = 'age-60-74-years'
  else targetSlug = 'age-75-years'

  const slugToNameMap = {
    'age-1-years': '< 1 years',
    'age-1-4-years': '1-4 years',
    'age-5-14-years': '5-14 years',
    'age-15-29-years': '15-29 years',
    'age-30-44-years': '30-44 years',
    'age-45-59-years': '45-59 years',
    'age-60-74-years': '60-74 years',
    'age-75-years': '75+ years'
  }
  const targetName = slugToNameMap[targetSlug]
  return ages.find(a => a.age === targetName)
}

// ─── TRUE ADAPTIVE GRAPHRAG: TINH TOAN NGU CANH MOI LUOT ────────────────────
export async function computeAdaptiveContext(sceResult, excludedSymptoms = new Set()) {
  const session = driver.session({ database: env.neo4jDatabase })

  let confirmedSymptomsSet = new Set()
  let excludedSymptomsSet = new Set()
  let demographics = { age: null, sex: null }
  let symptomsListSCE = []

  if (sceResult && typeof sceResult === 'object' && !(sceResult instanceof Set) && !Array.isArray(sceResult)) {
    // Luồng cấu trúc SCE JSON mới
    demographics = sceResult.demographics || { age: null, sex: null }
    symptomsListSCE = sceResult.symptoms || []
    for (const sym of symptomsListSCE) {
      if (sym.status === 'positive') {
        confirmedSymptomsSet.add(sym.symptomId)
      } else if (sym.status === 'negative') {
        excludedSymptomsSet.add(sym.symptomId)
      }
    }
  } else {
    // Giữ tương thích ngược với kiểu dữ liệu cũ (Set)
    confirmedSymptomsSet = sceResult instanceof Set ? sceResult : new Set(sceResult || [])
    excludedSymptomsSet = excludedSymptoms instanceof Set ? excludedSymptoms : new Set(excludedSymptoms || [])
  }

  try {
    const allSymptoms = await getAllSymptoms(session)
    const allSymptomNames = allSymptoms.map(s => s.name)
    const symptomsArr = Array.from(confirmedSymptomsSet)
    const excludedArr = Array.from(excludedSymptomsSet)

    // Xây dựng bản đồ trọng số cho câu lệnh Cypher
    const symptomWeights = {}
    if (symptomsListSCE.length > 0) {
      for (const sym of symptomsListSCE) {
        if (sym.status === 'positive') {
          symptomWeights[sym.symptomId] = sym.role === 'chief_complaint'
            ? env.wChiefComplaint
            : env.wAssociated
        }
      }
    } else {
      // Giá trị trọng số mặc định cho luồng cũ
      symptomsArr.forEach(slug => {
        symptomWeights[slug] = 1.0
      })
    }

    let rankedDiseases = []

    if (symptomsArr.length > 0) {
      // Thực hiện truy vấn Neo4j với trọng số Bayesian phân vai triệu chứng
      const diseaseRes = await session.run(`
        MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
        WHERE s.id IN $symptoms
        WITH d, s, r,
             coalesce($symptomWeights[s.id], 1.0) AS w
        WITH d,
             count(s) AS matched_count,
             sum(r.probability * w) AS base_score,
             collect({symptom: s.name, prob: r.probability, description: s.description}) AS matched_details
        ORDER BY matched_count DESC, base_score DESC
        LIMIT 8
        OPTIONAL MATCH (d)-[ra:AFFECTS_AGE]->(a:AgeGroup)
        OPTIONAL MATCH (d)-[rg:AFFECTS_SEX]->(g:Sex)
        WITH d, matched_count, base_score, matched_details,
             collect(DISTINCT {age: a.name, prob: ra.probability}) AS ages,
             collect(DISTINCT {sex: g.name, prob: rg.probability}) AS sexes
        RETURN d.name AS disease, d.description AS description, d.remarks AS remarks,
               matched_count, base_score, matched_details, ages, sexes
      `, { symptoms: symptomsArr, symptomWeights: symptomWeights })

      let penaltyMap = {}
      if (excludedArr.length > 0) {
        const penaltyRes = await session.run(`
          MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
          WHERE d.name IN $diseaseNames AND s.id IN $excluded
          RETURN d.name AS disease, sum(r.probability) AS penalty_sum
        `, {
          diseaseNames: diseaseRes.records.map(r => r.get('disease')),
          excluded: excludedArr
        })
        penaltyRes.records.forEach(r => {
          penaltyMap[r.get('disease')] = r.get('penalty_sum') || 0
        })
      }

      rankedDiseases = diseaseRes.records.map(r => {
        const name = r.get('disease')
        const baseScore = r.get('base_score')
        const penalty = (penaltyMap[name] || 0) * env.penaltyMultiplier

        // Tích hợp dữ liệu dịch tễ học và giới tính (Odds Bayesian prior adjustment)
        let demographicMultiplier = 1.0
        if (demographics.age) {
          const matchedAgeGroup = findAgeGroup(demographics.age, r.get('ages') || [])
          if (matchedAgeGroup && matchedAgeGroup.prob !== null && matchedAgeGroup.prob !== undefined) {
            demographicMultiplier *= Math.max(0.1, matchedAgeGroup.prob)
          }
        }
        if (demographics.sex) {
          const matchedSex = (r.get('sexes') || []).find(s => s.sex && s.sex.toLowerCase() === demographics.sex.toLowerCase())
          if (matchedSex && matchedSex.prob !== null && matchedSex.prob !== undefined) {
            demographicMultiplier *= Math.max(0.1, matchedSex.prob)
          }
        }

        const score = Math.max(0, baseScore * demographicMultiplier - penalty)

        return {
          name,
          description: r.get('description') || '',
          remarks: r.get('remarks') || '',
          matchedCount: r.get('matched_count').toNumber(),
          score: score,
          matchedDetails: r.get('matched_details').map(s => ({
            symptom: s.symptom,
            prob: s.prob,
            description: s.description || ''
          })).sort((a, b) => b.prob - a.prob).slice(0, 6),
          ages: r.get('ages').filter(a => a.age && a.prob).sort((a, b) => b.prob - a.prob).slice(0, 2),
          sexes: r.get('sexes').filter(s => s.sex && s.prob)
        }
      }).sort((a, b) => b.score - a.score)
    }

    let bestNextSymptoms = []
    const knownSymptoms = [...symptomsArr, ...excludedArr]

    if (rankedDiseases.length >= 2) {
      const topDiseaseNames = rankedDiseases.slice(0, 4).map(d => d.name)
      const discRes = await session.run(`
        MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
        WHERE d.name IN $topDiseases
          AND NOT s.id IN $known
        WITH s.name AS symptom, s.id AS sym_id, s.description AS description,
             collect({disease: d.name, prob: r.probability}) AS disease_probs,
             count(DISTINCT d) AS disease_count,
             stdev(r.probability) AS prob_stdev,
             avg(r.probability) AS prob_avg
        WHERE disease_count >= 2
        RETURN symptom, sym_id, description, disease_probs, disease_count, prob_stdev, prob_avg
        ORDER BY prob_stdev DESC, prob_avg DESC
        LIMIT 30
      `, { topDiseases: topDiseaseNames, known: knownSymptoms })

      bestNextSymptoms = discRes.records.map(rec => ({
        name: rec.get('symptom'),
        id: rec.get('sym_id'),
        description: rec.get('description') || '',
        stdev: rec.get('prob_stdev'),
        avgProb: rec.get('prob_avg'),
        byDisease: rec.get('disease_probs')
      }))
    }

    let diseaseOverview = null
    if (symptomsArr.length === 0) {
      diseaseOverview = await getDiseaseOverview(session)
    }

    return { 
      allSymptomNames, 
      allSymptoms, 
      confirmedSymptoms: symptomsArr, 
      excludedSymptoms: excludedArr, 
      rankedDiseases, 
      bestNextSymptoms, 
      diseaseOverview,
      sce: sceResult && typeof sceResult === 'object' && !(sceResult instanceof Set) ? sceResult : null
    }

  } finally {
    await session.close()
  }
}

// ─── FORMAT NGU CANH THANH VAN BAN CHO SYSTEM PROMPT ─────────────────────────
export function formatAdaptiveContext(ctx, lang = 'vi') {
  const { confirmedSymptoms, excludedSymptoms, rankedDiseases, bestNextSymptoms, diseaseOverview, sce } = ctx
  const isEn = lang === 'en'

  let text = isEn ? '## ADAPTIVE GRAPH CONTEXT (Current Turn)\n\n' : '## ADAPTIVE GRAPH CONTEXT (Cap nhat luot nay)\n\n'

  // Định dạng thông tin thuộc tính nhân khẩu học (Demographics)
  if (sce && sce.demographics) {
    const { age, sex } = sce.demographics
    if (age || sex) {
      if (isEn) {
        text += `**Patient demographics:** ${age ? `Age: ${age}` : ''}${age && sex ? ', ' : ''}${sex ? `Sex: ${sex}` : ''}\n`
      } else {
        text += `**Thong tin benh nhan:** ${age ? `Tuoi: ${age}` : ''}${age && sex ? ', ' : ''}${sex ? `Gioi tinh: ${sex}` : ''}\n`
      }
    }
  }

  // Định dạng đặc điểm thời gian của triệu chứng (Temporal)
  if (sce && sce.temporal) {
    const { durationValue, durationUnit, onset } = sce.temporal
    if (durationValue || onset) {
      if (isEn) {
        text += `**Onset & Duration:** ${durationValue ? `${durationValue} ${durationUnit}` : ''}${durationValue && onset ? ' (' : ''}${onset ? `${onset}` : ''}${durationValue && onset ? ')' : ''}\n`
      } else {
        text += `**Thoi gian khoi phat:** ${durationValue ? `${durationValue} ${durationUnit}` : ''}${durationValue && onset ? ' (' : ''}${onset ? `${onset}` : ''}${durationValue && onset ? ')' : ''}\n`
      }
    }
  }

  if (confirmedSymptoms.length === 0 && diseaseOverview) {
    if (isEn) {
      text += `**Status:** Conversation start — no symptoms confirmed yet.\n\n`
      text += `**All diseases in NLICE graph and their characteristic symptoms:**\n`
    } else {
      text += `**Trang thai:** Dau hoi thoai — chua xac nhan trieu chung nao.\n\n`
      text += `**Toan bộ benh trong do thi NLICE va cac trieu chung dac trung:**\n`
    }
    diseaseOverview.slice(0, 15).forEach(d => {
      const symList = d.symptoms.map(s => `${s.symptom} (${s.prob.toFixed(1)}%${s.description ? ` - Desc: ${s.description}` : ''})`).join(', ')
      text += `- **${d.name}**: ${symList}\n`
      if (d.remarks) text += isEn ? `  (Epidemiology: ${d.remarks})\n` : `  (Dich te: ${d.remarks})\n`
    })
    text += isEn ? `\n**Mission:** Ask the user to describe symptoms. Then refer to the list above to guide clarification.\n`
                 : `\n**Nhiem vu:** Hoi nguoi dung mo ta trieu chung. Sau do doc bang tren de xac dinh nhom benh va hoi cau phan biet.\n`
    return text
  }

  if (confirmedSymptoms.length > 0) {
    const positiveSymptomsSCE = sce ? sce.symptoms.filter(s => s.status === 'positive') : []
    if (positiveSymptomsSCE.length > 0) {
      const ccList = positiveSymptomsSCE.filter(s => s.role === 'chief_complaint').map(s => `${s.name} (Slug: ${s.symptomId}${s.attributes?.bodyLocation ? `, Location: ${s.attributes.bodyLocation}` : ''})`)
      const asList = positiveSymptomsSCE.filter(s => s.role !== 'chief_complaint').map(s => `${s.name} (Slug: ${s.symptomId})`)
      
      if (ccList.length > 0) {
        text += isEn ? `**Chief Complaint:** ${ccList.join(', ')}\n` : `**Trieu chung chinh (Chief Complaint):** ${ccList.join(', ')}\n`
      }
      if (asList.length > 0) {
        text += isEn ? `**Associated Symptoms:** ${asList.join(', ')}\n` : `**Trieu chung di kem (Associated Symptoms):** ${asList.join(', ')}\n`
      }
    } else {
      text += isEn ? `**Confirmed Symptoms (Standardized Slugs):** ${confirmedSymptoms.join(', ')}\n`
                   : `**Trieu chung da xac nhan (Standardized Slugs):** ${confirmedSymptoms.join(', ')}\n`
    }
  }

  if (excludedSymptoms.length > 0) {
    text += isEn ? `**Excluded Symptoms (Standardized Slugs):** ${excludedSymptoms.join(', ')}\n`
                 : `**Trieu chung da loai tru (Standardized Slugs):** ${excludedSymptoms.join(', ')}\n`
  }

  text += isEn ? `\n### Disease Ranking by Bayesian Score:\n` : `\n### Bang xep hang benh theo Bayesian Score:\n`

  if (rankedDiseases.length === 0) {
    text += isEn ? `*Not enough symptoms to rank diseases — please ask for more.*\n`
                 : `*Chua du trieu chung de xep hang benh — hay hoi them.*\n`
  } else {
    const maxScore = rankedDiseases[0].score || 1
    rankedDiseases.slice(0, 5).forEach((d, idx) => {
      const pct = Math.min(95, Math.round((d.score / maxScore) * 85) + (idx === 0 ? 10 : 0))
      const symList = d.matchedDetails.map(s => `${s.symptom} (${s.prob.toFixed(1)}%${s.description ? ` - Desc: ${s.description}` : ''})`).join(', ')
      const ageInfo = d.ages.length > 0 ? (isEn ? ` | Common age: ` : ` | Tuoi pho bien: `) + d.ages.map(a => `${a.age} (${a.prob?.toFixed(1)}%)`).join(', ') : ''
      const sexInfo = d.sexes.length > 0 ? (isEn ? ` | Gender: ` : ` | Gioi tinh: `) + d.sexes.map(s => `${s.sex} (${s.prob?.toFixed(1)}%)`).join(', ') : ''

      text += `\n**${idx + 1}. ${d.name}** — Estimated Probability: ~${pct}%\n`
      if (d.description) text += isEn ? `   Medical description: ${d.description}\n` : `   Y khoa mo ta: ${d.description}\n`
      if (d.remarks) text += isEn ? `   Clinical stats: ${d.remarks}\n` : `   Thong ke lam sang: ${d.remarks}\n`
      text += isEn ? `   Matched symptoms: ${symList}${ageInfo}${sexInfo}\n` : `   Trieu chung khop: ${symList}${ageInfo}${sexInfo}\n`
    })
  }

  if (bestNextSymptoms && bestNextSymptoms.length > 0) {
    text += isEn ? `\n### Optimal Differential Symptoms (Clarification Suggested):\n`
                 : `\n### Trieu chung phan biet toi uu (goi y hoi tiep):\n`
    bestNextSymptoms.slice(0, 5).forEach(sym => {
      const breakdown = sym.byDisease
        .map(d => `${d.disease}: ${d.prob?.toFixed(1)}%`)
        .join(' vs ')
      const descText = sym.description ? ` - Desc: ${sym.description}` : ''
      text += `- **"${sym.name}"** (slug: ${sym.id}${descText}) — Probability gap between diseases: ${breakdown}\n`
    })
    text += isEn ? `-> Please ask the user about these symptoms to differentiate effectively.\n`
                 : `-> Hay hoi nguoi dung ve cac trieu chung nay de phan biet hieu qua nhat.\n`
  } else if (rankedDiseases.length > 0) {
    text += isEn ? `\n-> Adequate differential data collected. Please summarize the screening report.\n`
                 : `\n-> Da co du du lieu phan biet. Hay tong ket bao cao chan doan sang loc.\n`
  }

  return text
}

export async function closeDriver() {
  await driver.close()
}
