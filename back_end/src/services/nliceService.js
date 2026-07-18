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
      console.error(`[UMLS] API error: ${response.status}`)
      return []
    }
    const data = await response.json()
    return data.result?.results || []
  } catch (err) {
    console.error('[UMLS] Error calling UMLS search:', err.message)
    return []
  }
}

// Helper gọi OpenRouter Completion không stream
async function callOpenRouter(chatMessages) {
  if (!env.openrouterApiKey) return ""
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:4000',
        'X-Title': 'MedChat'
      },
      body: JSON.stringify({
        model: env.openrouterModel,
        messages: chatMessages,
        temperature: 0.1,
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) return ""
    const data = await response.json()
    return data.choices?.[0]?.message?.content ?? ""
  } catch (err) {
    console.error('[OpenRouter API Error]', err.message)
    return ""
  }
}

// ─── UMLS + LLM SEMANTIC SYMPTOM EXTRACTION ──────────────────────────────────
export async function extractSymptomsFromHistory(messages, symptomsList) {
  const confirmed = new Set()

  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ')

  if (!userMessages.trim()) return confirmed

  // BƯỚC 1: LLM dịch mô tả tiếng Việt sang các thuật ngữ triệu chứng tiếng Anh y học thô
  const translationPrompt = `Bạn là trợ lý y khoa chuyên nghiệp. Phân tích nội dung trò chuyện của bệnh nhân và liệt kê các triệu chứng lâm sàng bằng tiếng Anh (dạng danh từ ngắn gọn, ngăn cách bởi dấu phẩy).
Ví dụ: "Tôi bị ho có đờm và sốt nhẹ" -> "Cough, Fever, Productive cough"

Hội thoại: "${userMessages}"
Danh sách triệu chứng tiếng Anh:`

  const rawTranslation = await callOpenRouter([
    { role: 'system', content: 'Bạn chỉ trả về danh sách triệu chứng tiếng Anh ngắn gọn, phân cách bằng dấu phẩy.' },
    { role: 'user', content: translationPrompt }
  ])

  if (!rawTranslation) return confirmed
  const rawEnglishSymptoms = rawTranslation.split(',').map(s => s.trim()).filter(Boolean)
  console.log(`[LLM Translation] Extracted raw terms:`, rawEnglishSymptoms)

  // BƯỚC 2: Tìm kiếm UMLS API để lấy thông tin CUI y khoa chuẩn hóa
  const umlsResults = []
  for (const term of rawEnglishSymptoms) {
    const results = await searchUMLS(term)
    if (results && results.length > 0) {
      const topMatch = results[0]
      umlsResults.push({
        term: term,
        cui: topMatch.ui,
        name: topMatch.name
      })
    } else {
      umlsResults.push({
        term: term,
        cui: null,
        name: null
      })
    }
  }
  console.log(`[UMLS Validation] Search results:`, umlsResults)

  // BƯỚC 3: So khớp thông minh dựa trên CUI (Độ chính xác tuyệt đối)
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

  const unmatchedTerms = []

  for (const item of umlsResults) {
    let matchedId = null

    // 3a. Ưu tiên 1: Khớp bằng CUI
    if (item.cui && cuiToIdMap.has(item.cui.toLowerCase())) {
      matchedId = cuiToIdMap.get(item.cui.toLowerCase())
      console.log(`[CUI Match] "${item.term}" -> mapped via CUI ${item.cui} to Neo4j Symptom ID: "${matchedId}"`)
    }
    // 3b. Ưu tiên 2: Khớp tên hoặc slug thô tiếng Anh
    else {
      const termLower = item.term.toLowerCase()
      const cleanTerm = termLower.replace(/_/g, '-').replace(/\s+/g, '-')

      if (nameToIdMap.has(termLower)) {
        matchedId = nameToIdMap.get(termLower)
        console.log(`[Text Match] "${item.term}" -> mapped via exact name to Neo4j Symptom ID: "${matchedId}"`)
      } else if (idToIdMap.has(cleanTerm)) {
        matchedId = idToIdMap.get(cleanTerm)
        console.log(`[Text Match] "${item.term}" -> mapped via clean slug to Neo4j Symptom ID: "${matchedId}"`)
      } else if (item.name && nameToIdMap.has(item.name.toLowerCase())) {
        matchedId = nameToIdMap.get(item.name.toLowerCase())
        console.log(`[Text Match] "${item.term}" -> mapped via UMLS name "${item.name}" to Neo4j Symptom ID: "${matchedId}"`)
      }
    }

    if (matchedId) {
      confirmed.add(matchedId)
    } else {
      unmatchedTerms.push(item)
    }
  }

  // BƯỚC 4: Fallback LLM Match (chỉ dùng cho ~20% triệu chứng không có CUI khớp trực tiếp)
  if (unmatchedTerms.length > 0) {
    console.log(`[UMLS Fallback] Mapping remaining unmatched terms using LLM...`)
    const unmatchedDetails = unmatchedTerms.map(u => 
      u.cui ? `Term: "${u.term}" (UMLS Name: "${u.name}", CUI: ${u.cui})` : `Term: "${u.term}" (No UMLS CUI)`
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

    const verifiedRaw = await callOpenRouter([
      { role: 'system', content: 'Bạn là chuyên viên chuẩn hóa y khoa. Chỉ trả về danh sách các slug hợp lệ ngăn cách bằng dấu phẩy.' },
      { role: 'user', content: verificationPrompt }
    ])

    if (verifiedRaw && !verifiedRaw.toLowerCase().includes('none')) {
      const verifiedSlugs = verifiedRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      console.log(`[LLM Fallback Verification] Mapped slugs:`, verifiedSlugs)
      verifiedSlugs.forEach(slug => {
        const matchedSymptom = symptomsList.find(s => s.id.toLowerCase() === slug)
        if (matchedSymptom) {
          confirmed.add(matchedSymptom.id)
        }
      })
    }
  }

  return confirmed
}

// ─── TRUE ADAPTIVE GRAPHRAG: TINH TOAN NGU CANH MOI LUOT ────────────────────
export async function computeAdaptiveContext(confirmedSymptoms, excludedSymptoms = new Set()) {
  const session = driver.session({ database: env.neo4jDatabase })

  try {
    const allSymptoms = await getAllSymptoms(session)
    const allSymptomNames = allSymptoms.map(s => s.name)
    const symptomsArr = Array.from(confirmedSymptoms)
    const excludedArr = Array.from(excludedSymptoms)

    let rankedDiseases = []

    if (symptomsArr.length > 0) {
      const diseaseRes = await session.run(`
        MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
        WHERE s.id IN $symptoms
        WITH d,
             count(s) AS matched_count,
             sum(r.probability) AS base_score,
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
      `, { symptoms: symptomsArr })

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
        const penalty = (penaltyMap[name] || 0) * 0.4
        return {
          name,
          description: r.get('description') || '',
          remarks: r.get('remarks') || '',
          matchedCount: r.get('matched_count').toNumber(),
          score: Math.max(0, baseScore - penalty),
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

    let bestNextSymptom = null
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
        RETURN symptom, sym_id, disease_probs, disease_count, prob_stdev, prob_avg
        ORDER BY prob_stdev DESC, prob_avg DESC
        LIMIT 3
      `, { topDiseases: topDiseaseNames, known: knownSymptoms })

      if (discRes.records.length > 0) {
        const rec = discRes.records[0]
        bestNextSymptom = {
          name: rec.get('symptom'),
          id: rec.get('sym_id'),
          stdev: rec.get('prob_stdev'),
          avgProb: rec.get('prob_avg'),
          byDisease: rec.get('disease_probs')
        }
      }
    }

    let diseaseOverview = null
    if (symptomsArr.length === 0) {
      diseaseOverview = await getDiseaseOverview(session)
    }

    return { allSymptomNames, allSymptoms, confirmedSymptoms: symptomsArr, excludedSymptoms: excludedArr, rankedDiseases, bestNextSymptom, diseaseOverview }

  } finally {
    await session.close()
  }
}

// ─── FORMAT NGU CANH THANH VAN BAN CHO SYSTEM PROMPT ─────────────────────────
export function formatAdaptiveContext(ctx) {
  const { confirmedSymptoms, excludedSymptoms, rankedDiseases, bestNextSymptom, diseaseOverview } = ctx

  let text = '## ADAPTIVE GRAPH CONTEXT (Cap nhat luot nay)\n\n'

  if (confirmedSymptoms.length === 0 && diseaseOverview) {
    text += `**Trang thai:** Dau hoi thoai — chua xac nhan trieu chung nao.\n\n`
    text += `**Toan bo benh trong do thi NLICE va cac trieu chung dac trung:**\n`
    diseaseOverview.slice(0, 15).forEach(d => {
      const symList = d.symptoms.map(s => `${s.symptom} (${s.prob.toFixed(1)}%${s.description ? ` - Mo ta: ${s.description}` : ''})`).join(', ')
      text += `- **${d.name}**: ${symList}\n`
      if (d.remarks) text += `  (Dich te: ${d.remarks})\n`
    })
    text += `\n**Nhiem vu:** Hoi nguoi dung mo ta trieu chung. Sau do doc bang tren de xac dinh nhom benh va hoi cau phan biet.\n`
    return text
  }

  if (confirmedSymptoms.length > 0) {
    text += `**Trieu chung da xac nhan (Standardized Slugs):** ${confirmedSymptoms.join(', ')}\n`
  }
  if (excludedSymptoms.length > 0) {
    text += `**Trieu chung da loai tru (Standardized Slugs):** ${excludedSymptoms.join(', ')}\n`
  }

  text += `\n### Bang xep hang benh theo Bayesian Score:\n`

  if (rankedDiseases.length === 0) {
    text += `*Chua du trieu chung de xep hang benh — hay hoi them.*\n`
  } else {
    const maxScore = rankedDiseases[0].score || 1
    rankedDiseases.slice(0, 5).forEach((d, idx) => {
      const pct = Math.min(95, Math.round((d.score / maxScore) * 85) + (idx === 0 ? 10 : 0))
      const symList = d.matchedDetails.map(s => `${s.symptom} (${s.prob.toFixed(1)}%${s.description ? ` - Mo ta: ${s.description}` : ''})`).join(', ')
      const ageInfo = d.ages.length > 0 ? ` | Tuoi pho bien: ${d.ages.map(a => `${a.age} (${a.prob?.toFixed(1)}%)`).join(', ')}` : ''
      const sexInfo = d.sexes.length > 0 ? ` | Gioi tinh: ${d.sexes.map(s => `${s.sex} (${s.prob?.toFixed(1)}%)`).join(', ')}` : ''

      text += `\n**${idx + 1}. ${d.name}** — Xac suat uoc tinh: ~${pct}%\n`
      if (d.description) text += `   Y khoa mo ta: ${d.description}\n`
      if (d.remarks) text += `   Thong ke lam sang: ${d.remarks}\n`
      text += `   Trieu chung khop: ${symList}${ageInfo}${sexInfo}\n`
    })
  }

  if (bestNextSymptom) {
    const breakdown = bestNextSymptom.byDisease
      .map(d => `${d.disease}: ${d.prob?.toFixed(1)}%`)
      .join(' vs ')
    text += `\n### Trieu chung phan biet toi uu (goi y hoi tiep):\n`
    const descText = bestNextSymptom.description ? ` - Mo ta: ${bestNextSymptom.description}` : ''
    text += `**"${bestNextSymptom.name}"** (slug: ${bestNextSymptom.id}${descText}) — Do lech xac suat giua cac benh: ${breakdown}\n`
    text += `-> Hay hoi nguoi dung ve trieu chung nay de phan biet hieu qua nhat.\n`
  } else if (rankedDiseases.length > 0) {
    text += `\n-> Da co du du lieu phan biet. Hay tong ket bao cao chan doan sang loc.\n`
  }

  return text
}

export async function closeDriver() {
  await driver.close()
}
