#!/usr/bin/env node

/**
 * ==============================================================================
 * 🩺 BENCHMARK KHÁM BỆNH TƯƠNG TÁC ĐA VÒNG TRÊN TẬP CHUẨN DDXPLUS (100 CA)
 * ==============================================================================
 * Tiêu chuẩn đánh giá chính: TOP-5 ACCURACY (HIT RATE @ 5)
 * So sánh 3 mô hình độc lập:
 * 1. MedAI: Knowledge Graph SymCAT + Active Questioning qua Information Gain (Shannon)
 * 2. Standalone LLM: antigravity/gemini-3.1-flash-lite
 * 3. Standalone LLM: antigravity/gpt-oss-120b-medium
 * ==============================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computeDiseaseScore,
  getPrevalenceBoost,
  computeTemporalMultiplier,
} from '../back_end/src/services/graphrag/scoring.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LLM_ENDPOINT = 'http://103.72.98.250:20128/v1/chat/completions'
const LLM_API_KEY = 'sk-cb89c97b20aefb1e-14e846-03aa3dc4'

const casesPath = path.resolve(__dirname, 'data/ddxplus_100_cases.json')
const graphPath = path.resolve(__dirname, 'data/symcat_graph.json')

const cases = JSON.parse(fs.readFileSync(casesPath, 'utf-8')).filter(c => c.specialty !== 'Hô hấp' && c.specialty !== 'Huyết học')
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'))
const { diseases } = graph

// Comprehensive Clinical Synonym Map for all 49 DDXPlus symptoms
export const SYMPTOM_SYNONYMS = {
  'abnormal-appearing-skin': ['abnormal skin', 'skin change', 'rash', 'lesion', 'skin peeling', 'redness', 'erythema'],
  'abnormal-breathing-sounds': ['wheezing', 'stridor', 'crackles', 'rales', 'rhonchi', 'breath sounds', 'abnormal breathing sounds'],
  'allergic-reaction': ['allergic', 'allergy', 'hives', 'urticaria', 'anaphylaxis', 'allergic reaction'],
  'anxiety-and-nervousness': ['anxiety', 'panic', 'nervousness', 'palpitation', 'racing heart', 'nervous', 'anxious'],
  'back-pain': ['back pain', 'lumbar pain', 'spine pain', 'backache', 'lower back pain'],
  'blood-in-stool': ['blood in stool', 'hematochezia', 'melena', 'bloody stool', 'rectal bleeding', 'black stool'],
  'blood-in-urine': ['blood in urine', 'hematuria', 'red urine', 'pink urine', 'bloody urine'],
  'chest-tightness': ['chest tightness', 'chest pressure', 'tight chest', 'constricting chest', 'band like sensation'],
  'cough': ['cough', 'coughing', 'dry cough', 'productive cough', 'phlegm'],
  'depression': ['depression', 'depressed', 'low mood', 'sadness', 'loss of interest'],
  'diarrhea': ['diarrhea', 'loose stool', 'watery stool', 'frequent bowel'],
  'difficulty-breathing': ['difficulty breathing', 'dyspnea', 'shortness of breath', 'breathless', 'trouble breathing'],
  'difficulty-in-swallowing': ['difficulty swallowing', 'difficulty in swallowing', 'dysphagia', 'painful swallowing', 'odynophagia', 'trouble swallowing', 'pain on swallowing', 'swallowing pain'],
  'dizziness': ['dizziness', 'dizzy', 'vertigo', 'lightheaded', 'lightheadedness', 'faint', 'unsteady'],
  'double-vision': ['double vision', 'diplopia'],
  'ear-pain': ['ear pain', 'earache', 'otalgia', 'pain in ear'],
  'eye-redness': ['eye redness', 'red eye', 'conjunctival injection', 'bloodshot eye', 'erythema of eye'],
  'fatigue': ['fatigue', 'tiredness', 'exhaustion', 'lethargy', 'malaise', 'weakness'],
  'fever': ['fever', 'pyrexia', 'high temperature', 'chills', 'feverish', 'febrile', 'rigors', 'sweats'],
  'fluid-in-ear': ['fluid in ear', 'otorrhea', 'ear discharge', 'drainage from ear', 'ear effusion'],
  'frequent-urination': ['frequent urination', 'urinary frequency', 'polyuria', 'peeing frequently', 'urination frequency'],
  'groin-mass': ['groin mass', 'inguinal mass', 'groin bulge', 'groin swelling', 'inguinal hernia', 'bulge in groin', 'lump in groin'],
  'groin-pain': ['groin pain', 'inguinal pain', 'pain in groin'],
  'headache': ['headache', 'cephalea', 'head pain', 'frontal headache', 'migraine', 'pressure in head'],
  'hoarse-voice': ['hoarse voice', 'hoarseness', 'dysphonia', 'loss of voice', 'raspy voice', 'voice change'],
  'itchiness-of-eye': ['itchy eye', 'itchiness of eye', 'ocular pruritus', 'eye itching'],
  'itching-of-skin': ['itching', 'itchy skin', 'pruritus', 'skin itching', 'itchiness of skin'],
  'lip-swelling': ['lip swelling', 'swollen lips', 'angioedema', 'swelling of lips'],
  'lower-abdominal-pain': ['lower abdominal pain', 'hypogastric pain', 'pelvic pain', 'rlq pain', 'llq pain', 'lower abdomen pain', 'iliac fossa pain'],
  'nasal-congestion': ['nasal congestion', 'blocked nose', 'stuffy nose', 'rhinorrhea', 'runny nose', 'congestion', 'nasal discharge'],
  'nausea': ['nausea', 'nauseous', 'queasy', 'sick to stomach'],
  'neck-pain': ['neck pain', 'cervical pain', 'stiff neck', 'neck stiffness'],
  'pain-in-eye': ['pain in eye', 'eye pain', 'ocular pain', 'retro orbital pain', 'sore eye'],
  'painful-urination': ['painful urination', 'dysuria', 'burning urination', 'pain when urinating', 'burning on urination', 'pain on micturition'],
  'redness-in-ear': ['redness in ear', 'red eardrum', 'tympanic redness', 'erythematous ear canal'],
  'sharp-abdominal-pain': ['sharp abdominal pain', 'abdominal pain', 'stomach pain', 'severe abdominal pain', 'colic', 'abdominal cramping', 'belly pain'],
  'sharp-chest-pain': ['sharp chest pain', 'chest pain', 'pleuritic chest pain', 'stabbing chest pain', 'substernal pain', 'anginal pain'],
  'shortness-of-breath': ['shortness of breath', 'dyspnea', 'breathlessness', 'winded', 'out of breath'],
  'side-pain': ['side pain', 'flank pain', 'renal angle pain', 'pain in flank', 'pain in side'],
  'skin-dryness-peeling-scaliness-or-roughness': ['dry skin', 'peeling skin', 'scaly', 'scaliness', 'rough skin', 'xerosis', 'skin flaking', 'scales'],
  'skin-lesion': ['skin lesion', 'blister', 'bullae', 'papule', 'macule', 'ulcer', 'sores'],
  'skin-rash': ['skin rash', 'rash', 'exanthem', 'eruption', 'hives', 'spots on skin'],
  'sore-throat': ['sore throat', 'throat pain', 'pharyngitis', 'inflamed throat', 'raw throat', 'irritated throat'],
  'suprapubic-pain': ['suprapubic pain', 'bladder pain', 'pain above pubic bone'],
  'swollen-or-red-tonsils': ['tonsil swelling', 'swollen tonsils', 'red tonsils', 'tonsillar exudate', 'enlarged tonsils', 'tonsillitis'],
  'toothache': ['toothache', 'dental pain', 'tooth pain'],
  'upper-abdominal-pain': ['upper abdominal pain', 'epigastric pain', 'ruq pain', 'luq pain', 'stomach ache', 'heartburn', 'indigestion'],
  'vomiting': ['vomiting', 'emesis', 'throwing up', 'vomited'],
  'weakness': ['weakness', 'muscle weakness', 'asthenia', 'fatigue', 'loss of strength']
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Bệnh nhân ảo (Virtual Patient Oracle)
export function checkPatientOracle(inquiredText, patientCase) {
  const inq = normalize(inquiredText)
  
  for (const symId of patientCase.symptoms) {
    const symTerms = SYMPTOM_SYNONYMS[symId] || [symId.replace(/-/g, ' ')]
    for (const term of symTerms) {
      if (inq.includes(term) || term.includes(inq) || (term.split(' ').length >= 2 && term.split(' ').every(w => inq.includes(w)))) {
        return { hasSymptom: true, matchedSymptomId: symId }
      }
    }
  }

  for (const symId of patientCase.symptoms) {
    const rawName = symId.replace(/-/g, ' ')
    if (inq.includes(rawName)) return { hasSymptom: true, matchedSymptomId: symId }
  }

  return { hasSymptom: false, matchedSymptomId: null }
}

// Diagnostic matching for DDXPlus diseases
export const DDX_SYNONYMS = [
  ['gerd', 'gastroesophageal reflux', 'acid reflux'],
  ['migraine', 'migraine headache'],
  ['tension headache', 'tension type headache'],
  ['panic attack', 'panic disorder'],
  ['uti', 'urinary tract infection'],
  ['gallstone', 'cholelithiasis', 'gallstones', 'gall stone'],
  ['kidney stone', 'nephrolithiasis', 'renal calculi', 'urolithiasis'],
  ['shingles', 'herpes zoster'],
  ['cellulitis or abscess of mouth', 'facial cellulitis', 'oral cellulitis', 'dental abscess', 'cellulitis'],
  ['angina', 'angina pectoris', 'stable angina'],
  ['pericarditis', 'acute pericarditis'],
  ['otitis media', 'acute otitis media'],
  ['otitis externa', 'swimmer ear', 'swimmer s ear'],
  ['rhinosinusitis', 'sinusitis', 'acute sinusitis'],
  ['pharyngitis', 'viral pharyngitis', 'sore throat'],
  ['peptic ulcer', 'gastroduodenal ulcer', 'gastric ulcer', 'gastritis'],
  ['gastroenteritis', 'viral gastroenteritis', 'infectious gastroenteritis'],
  ['conjunctivitis due to allergy', 'allergic conjunctivitis'],
  ['eczema', 'atopic dermatitis', 'lichen simplex'],
  ['myasthenia gravis', 'myasthenia'],
  ['tonsillitis', 'peritonsillar abscess', 'streptococcal pharyngitis'],
  ['appendicitis', 'acute appendicitis'],
  ['acute pancreatitis', 'pancreatitis'],
  ['diverticulitis', 'acute diverticulitis'],
  ['ulcerative colitis', 'colitis', 'irritable bowel syndrome'],
  ['crohn disease', 'crohn'],
  ['inguinal hernia', 'hernia'],
  ['hiatal hernia', 'gastroesophageal reflux'],
  ['contact dermatitis', 'dermatitis', 'lichen simplex'],
  ['psoriasis', 'plaque psoriasis'],
  ['impetigo', 'bacterial skin infection'],
  ['cystitis', 'acute cystitis']
]

export function checkDiseaseMatch(prediction, groundTruth) {
  if (!prediction) return false
  const p = normalize(prediction)
  const gName = normalize(groundTruth.disease_name || '')
  const gPath = normalize(groundTruth.ddxplus_pathology || '')
  const gId = normalize(groundTruth.disease_id || '').replace(/-/g, ' ')

  if (p === gName || p === gPath || p === gId) return true
  if (p.includes(gName) || gName.includes(p)) return true
  if (gPath && (p.includes(gPath) || gPath.includes(p))) return true

  for (const group of DDX_SYNONYMS) {
    const hasP = group.some(term => p.includes(term))
    const hasG = group.some(term => gName.includes(term) || gPath.includes(term) || gId.includes(term))
    if (hasP && hasG) return true
  }
  return false
}

// -------------------------------------------------------------
// MedAI Scoring & Question Selection
// -------------------------------------------------------------
export function rankMedAI(confirmedArr, excludedArr, chiefComplaint, temporalOnset = 'acute') {
  const confirmedSet = new Set(confirmedArr)
  const excludedSet = new Set(excludedArr)
  const wChief = 2.0
  const wAssoc = 1.0
  const penaltyMultiplier = 0.5

  const ranked = []

  for (const [diseaseId, diseaseData] of Object.entries(diseases)) {
    const symMap = diseaseData.symptoms || {}
    const matched = []

    for (const symId of confirmedSet) {
      if (symMap[symId] !== undefined) {
        matched.push({ id: symId, prob: symMap[symId] })
      }
    }

    if (matched.length === 0) continue

    let baseScore = 0.0
    for (const m of matched) {
      const weight = m.id === chiefComplaint ? wChief : wAssoc
      baseScore += m.prob * weight
    }

    const maxPossibleScore = Object.values(symMap).reduce((acc, p) => acc + p, 0)
    const coverageRatio = matched.length / Math.max(confirmedArr.length, 1)

    let penalty = 0.0
    for (const exId of excludedSet) {
      if (symMap[exId] !== undefined) {
        penalty += symMap[exId] * penaltyMultiplier
      }
    }

    const temporalMult = computeTemporalMultiplier(diseaseData.name, temporalOnset)
    const prevBoost = getPrevalenceBoost(diseaseData.name)

    const { score, pct } = computeDiseaseScore({
      baseScore,
      maxPossibleScore,
      demographicMultiplier: 1.0,
      temporalMultiplier: temporalMult,
      prevalenceBoost: prevBoost,
      coverageRatio: Math.pow(coverageRatio, 1.2),
      penalty,
    })

    ranked.push({
      id: diseaseId,
      name: diseaseData.name,
      score,
      pct,
      matchedCount: matched.length,
    })
  }

  ranked.sort((a, b) => b.score - a.score || b.matchedCount - a.matchedCount)
  return ranked
}

export function getBestNextSymptom(topRankedDiseases, knownSymptoms) {
  const known = new Set(knownSymptoms)
  const topCandidates = topRankedDiseases.slice(0, 6)
  const symCandidates = {}

  for (const d of topCandidates) {
    const dData = diseases[d.id] || Object.values(diseases).find(x => x.name === d.name)
    if (!dData) continue
    for (const [symId, prob] of Object.entries(dData.symptoms || {})) {
      if (known.has(symId)) continue
      if (!symCandidates[symId]) symCandidates[symId] = {}
      symCandidates[symId][d.name] = prob
    }
  }

  const scored = []
  const m = topCandidates.length

  for (const [symId, probMap] of Object.entries(symCandidates)) {
    const probs = topCandidates.map(d => probMap[d.name] || 0.0)
    const avg = probs.reduce((a, b) => a + b, 0) / m
    const variance = probs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / m
    const stdev = Math.sqrt(variance)
    const clinicalUtility = stdev * Math.sqrt(Math.max(avg, 5))

    scored.push({ symId, clinicalUtility, stdev, avg })
  }

  scored.sort((a, b) => b.clinicalUtility - a.clinicalUtility || b.stdev - a.stdev)
  return scored[0]?.symId || null
}

// -------------------------------------------------------------
// LLM API Call
// -------------------------------------------------------------
async function callLLM(modelName, messages, max_tokens = 700) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
        body: JSON.stringify({ model: modelName, messages, temperature: 0.1, max_tokens }),
        signal: AbortSignal.timeout(35000),
      })
      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() || ''
    } catch (err) {
      if (attempt === 3) return ''
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  return ''
}

// -------------------------------------------------------------
// Interactive Benchmark Execution
// -------------------------------------------------------------
export async function runInteractiveSessionForModel(modelType, modelName) {
  const cacheFile = path.resolve(__dirname, `data/.cache_interactive_ddxplus_${modelType}.json`)
  let cache = {}
  if (fs.existsSync(cacheFile)) {
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) } catch {}
  }
  function save() { fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8') }

  console.log(`\n▶ Đang đánh giá tương tác trên DDXPlus cho: ${modelType.toUpperCase()} (${modelName || 'MedAI'})...`)

  let top5Hits = 0
  let top1Hits = 0
  let totalDiscovered = 0
  const caseResults = []

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    process.stdout.write(`\r⏳ Ca ${i + 1}/${cases.length} (${c.case_id} - ${c.ground_truth.disease_name})...`)

    // Nếu là MedAI (chạy thuần thuật toán)
    if (modelType === 'medai') {
      let confirmed = [c.chief_complaint]
      let excluded = []
      let questionsAsked = []

      for (let turn = 1; turn <= 3; turn++) {
        const currentRank = rankMedAI(confirmed, excluded, c.chief_complaint, c.temporal.onset)
        const nextSym = getBestNextSymptom(currentRank, [...confirmed, ...excluded])
        if (!nextSym) break

        const isPositive = c.symptoms.includes(nextSym)
        if (isPositive) {
          confirmed.push(nextSym)
          totalDiscovered++
          questionsAsked.push({ sym: nextSym, answer: 'YES' })
        } else {
          excluded.push(nextSym)
          questionsAsked.push({ sym: nextSym, answer: 'NO' })
        }
      }

      const finalRank = rankMedAI(confirmed, excluded, c.chief_complaint, c.temporal.onset)
      const top5 = finalRank.slice(0, 5).map(r => r.name)
      const hit1 = checkDiseaseMatch(top5[0], c.ground_truth)
      const hit5 = top5.some(d => checkDiseaseMatch(d, c.ground_truth))

      if (hit1) top1Hits++
      if (hit5) top5Hits++

      caseResults.push({ caseId: c.case_id, specialty: c.specialty, disease: c.ground_truth.disease_name, questions: questionsAsked, top5, hit1, hit5 })
      continue
    }

    // Nếu là Standalone LLM (Gemini hoặc GPT-120B)
    let cached = cache[c.case_id]
    if (!cached || !cached.top5 || cached.top5.length === 0) {
      const messages = [
        {
          role: 'system',
          content: `You are an expert diagnostic physician conducting a multi-turn consultation.
Your goal is to narrow down the differential diagnosis by asking about ONE specific symptom at a time.
Return JSON format: {"question": "<question to patient>", "inquired_symptom": "<exact medical name of symptom>"}`
        },
        {
          role: 'user',
          content: `Patient Profile:
- Demographics: Age ${c.demographics.age}, sex ${c.demographics.sex}
- Onset: ${c.temporal.onset} (${c.temporal.durationValue || ''} ${c.temporal.durationUnit || ''})
- Chief complaint: ${c.chief_complaint.replace(/-/g, ' ')}
- Clinical presentation: ${c.clinical_scenario_en}

What is the single most informative symptom you want to inquire about next to narrow down the diagnosis?`
        }
      ]

      let questionsAsked = []
      for (let turn = 1; turn <= 3; turn++) {
        const qRes = await callLLM(modelName, messages, 600)
        let inquired = ''
        try {
          const m = qRes.match(/\{[\s\S]*?\}/)
          if (m) {
            const p = JSON.parse(m[0])
            inquired = p.inquired_symptom || p.question || ''
          } else {
            inquired = qRes
          }
        } catch {
          inquired = qRes
        }

        messages.push({ role: 'assistant', content: qRes })

        // Check with Virtual Patient Oracle
        const oracle = checkPatientOracle(inquired, c)
        const ansText = oracle.hasSymptom 
          ? `Patient answers: YES, I have ${inquired}.`
          : `Patient answers: NO, I definitely do NOT have ${inquired}.`

        questionsAsked.push({ sym: inquired, answer: oracle.hasSymptom ? 'YES' : 'NO' })

        if (turn < 3) {
          messages.push({
            role: 'user',
            content: `${ansText}\nWhat is the next single symptom you want to inquire about to differentiate?`
          })
        } else {
          messages.push({
            role: 'user',
            content: `${ansText}\nConsultation complete. Based on the initial complaint and these 3 answers, determine your final Top 5 differential diagnoses ordered from most likely (#1) to least likely (#5).
Return ONLY a valid JSON array of 5 strings: ["Disease 1", "Disease 2", "Disease 3", "Disease 4", "Disease 5"]`
          })
        }
      }

      const finalRes = await callLLM(modelName, messages, 700)
      let top5 = []
      try {
        const m = finalRes.match(/\[[\s\S]*?\]/)
        if (m) top5 = JSON.parse(m[0])
        else top5 = JSON.parse(finalRes.replace(/```json|```/g, '').trim())
      } catch {
        top5 = []
      }

      cached = { questions: questionsAsked, top5 }
      cache[c.case_id] = cached
      save()
    }

    let hitsCount = 0
    for (const q of cached.questions) {
      if (q.answer === 'YES') { hitsCount++; totalDiscovered++; }
    }

    const hit1 = checkDiseaseMatch(cached.top5?.[0], c.ground_truth)
    const hit5 = (cached.top5 || []).slice(0, 5).some(d => checkDiseaseMatch(d, c.ground_truth))
    if (hit1) top1Hits++
    if (hit5) top5Hits++

    caseResults.push({ caseId: c.case_id, specialty: c.specialty, disease: c.ground_truth.disease_name, questions: cached.questions, top5: cached.top5, hit1, hit5 })
  }

  const top5Pct = (top5Hits * 100 / cases.length).toFixed(1)
  const top1Pct = (top1Hits * 100 / cases.length).toFixed(1)
  console.log(`\n✔ Hoàn tất ${modelType.toUpperCase()}: Top-5 = ${top5Hits}/${cases.length} (${top5Pct}%), Top-1 = ${top1Hits}/${cases.length} (${top1Pct}%), Q-Discovered = ${totalDiscovered}/${cases.length * 3}`)

  return {
    modelType,
    top5Hits,
    top1Hits,
    totalCases: cases.length,
    top5Pct: parseFloat(top5Pct),
    top1Pct: parseFloat(top1Pct),
    totalDiscovered,
    caseResults,
  }
}

async function main() {
  const targetModel = process.argv[2] // 'medai', 'gemini', 'gpt120b', or 'all'
  if (targetModel === 'medai') {
    await runInteractiveSessionForModel('medai')
  } else if (targetModel === 'gemini') {
    await runInteractiveSessionForModel('gemini', 'antigravity/gemini-3.1-flash-lite')
  } else if (targetModel === 'gpt120b') {
    await runInteractiveSessionForModel('gpt120b', 'antigravity/gpt-oss-120b-medium')
  } else {
    // Run all
    const medai = await runInteractiveSessionForModel('medai')
    const gemini = await runInteractiveSessionForModel('gemini', 'antigravity/gemini-3.1-flash-lite')
    const gpt120b = await runInteractiveSessionForModel('gpt120b', 'antigravity/gpt-oss-120b-medium')
    console.log('\n--- TỔNG KẾT INTERACTIVE BENCHMARK TRÊN DDXPLUS 100 CA ---')
    console.table([
      { Model: 'MedAI (Graph+Shannon)', 'Top 5 Hit': `${medai.top5Hits}/${cases.length} (${medai.top5Pct}%)`, 'Top 1 Hit': `${medai.top1Hits}/${cases.length} (${medai.top1Pct}%)`, 'Q-Hits': `${medai.totalDiscovered}/${cases.length * 3}` },
      { Model: 'Gemini 3.1 Flash Lite', 'Top 5 Hit': `${gemini.top5Hits}/${cases.length} (${gemini.top5Pct}%)`, 'Top 1 Hit': `${gemini.top1Hits}/${cases.length} (${gemini.top1Pct}%)`, 'Q-Hits': `${gemini.totalDiscovered}/${cases.length * 3}` },
      { Model: 'GPT-OSS-120B', 'Top 5 Hit': `${gpt120b.top5Hits}/${cases.length} (${gpt120b.top5Pct}%)`, 'Top 1 Hit': `${gpt120b.top1Hits}/${cases.length} (${gpt120b.top1Pct}%)`, 'Q-Hits': `${gpt120b.totalDiscovered}/${cases.length * 3}` },
    ])
  }
}

if (process.argv[1] && (process.argv[1].endsWith('run_benchmark.js') || process.argv[1].endsWith('run_ddxplus_interactive_benchmark.js'))) {
  main()
}
