process.env.OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash'
import { extractSymptomsFromHistory, computeAdaptiveContext } from './src/services/nliceService.js'
import fs from 'fs'
import path from 'path'

// 10 test cases y khoa thực nghiệm (Ground Truth)
const testCases = [
  {
    id: 1,
    description: "Đau bụng kèm buồn nôn, không sốt",
    messages: [
      { role: 'user', content: 'Tôi bị đau bụng nhiều và buồn nôn, không bị sốt' }
    ],
    expected: {
      confirmed: ['abdominal-pain', 'nausea'],
      excluded: ['fever'],
      cc: 'abdominal-pain',
      age: null,
      sex: null
    }
  },
  {
    id: 2,
    description: "Đau đầu dữ dội, chóng mặt, không nôn (đủ tuổi, giới tính)",
    messages: [
      { role: 'user', content: 'Tôi 22 tuổi, là nam, đau đầu dữ dội kèm theo chóng mặt, không thấy nôn mửa' }
    ],
    expected: {
      confirmed: ['headache', 'dizziness'],
      excluded: ['vomiting'],
      cc: 'headache',
      age: 22,
      sex: 'male'
    }
  },
  {
    id: 3,
    description: "Sốt và ho ở trẻ nhỏ",
    messages: [
      { role: 'user', content: 'Bé nhà tôi 5 tuổi, bị sốt cao và ho khan nhiều ngày nay' }
    ],
    expected: {
      confirmed: ['fever', 'cough'],
      excluded: [],
      cc: 'fever',
      age: 5,
      sex: null
    }
  },
  {
    id: 4,
    description: "Đau tức ngực, khó thở, không đau bụng",
    messages: [
      { role: 'user', content: 'Tôi đau tức ngực và khó thở khi vận động mạnh, không bị đau bụng' }
    ],
    expected: {
      confirmed: ['chest-pain', 'shortness-of-breath'],
      excluded: ['abdominal-pain'],
      cc: 'chest-pain',
      age: null,
      sex: null
    }
  },
  {
    id: 5,
    description: "Đau đầu sau gáy (chẩm) kèm chóng mặt, không sốt",
    messages: [
      { role: 'user', content: 'Đau đầu sau gáy ghê gớm, thỉnh thoảng chóng mặt, không sốt' }
    ],
    expected: {
      confirmed: ['headache', 'dizziness'],
      excluded: ['fever'],
      cc: 'headache',
      age: null,
      sex: null
    }
  },
  {
    id: 6,
    description: "Đau họng, ho có đờm, không khó thở",
    messages: [
      { role: 'user', content: 'Tôi bị đau họng và ho có đờm nhiều, phổi bình thường không khó thở' }
    ],
    expected: {
      confirmed: ['sore-throat', 'cough'],
      excluded: ['shortness-of-breath'],
      cc: 'sore-throat',
      age: null,
      sex: null
    }
  },
  {
    id: 7,
    description: "Đau tai, chảy mủ từ tai, không ù tai",
    messages: [
      { role: 'user', content: 'Tôi bị đau tai và chảy mủ từ tai ra, không bị ù tai' }
    ],
    expected: {
      confirmed: ['ear-pain', 'bleeding-from-ear'], // 'bleeding-from-ear' or discharge
      excluded: ['ringing-in-ears'],
      cc: 'ear-pain',
      age: null,
      sex: null
    }
  },
  {
    id: 8,
    description: "Đau lưng dữ dội lan xuống chân, không liệt",
    messages: [
      { role: 'user', content: 'Tôi đau lưng dữ dội lan xuống cả hai chân, không bị liệt hay mất cảm giác' }
    ],
    expected: {
      confirmed: ['back-pain', 'leg-pain'],
      excluded: ['paralysis'],
      cc: 'back-pain',
      age: null,
      sex: null
    }
  },
  {
    id: 9,
    description: "Ngứa da, nổi mẩn đỏ, không sốt (nữ 30 tuổi)",
    messages: [
      { role: 'user', content: 'Tôi là nữ, 30 tuổi, bị ngứa da và nổi mẩn đỏ khắp người, không bị sốt' }
    ],
    expected: {
      confirmed: ['itchy-skin', 'skin-rash'],
      excluded: ['fever'],
      cc: 'itchy-skin',
      age: 30,
      sex: 'female'
    }
  },
  {
    id: 10,
    description: "Mất ngủ kéo dài kèm mệt mỏi, không sụt cân",
    messages: [
      { role: 'user', content: 'Tôi bị mất ngủ kéo dài kèm mệt mỏi rã rời, không bị sụt cân' }
    ],
    expected: {
      confirmed: ['insomnia', 'fatigue'],
      excluded: ['weight-loss'],
      cc: 'insomnia',
      age: null,
      sex: null
    }
  }
]

async function runQuantitativeTest() {
  console.log("=============================================================")
  console.log("STARTING QUANTITATIVE CLINICAL NLP & CDSS EVALUATION")
  console.log("=============================================================")

  // Đọc danh sách tất cả triệu chứng từ Neo4j để làm từ điển map
  const firstCtx = await computeAdaptiveContext(new Set(), new Set())
  const symptomsList = firstCtx.allSymptoms
  
  let metrics = {
    confirmed: { tp: 0, fp: 0, fn: 0 },
    excluded: { tp: 0, fp: 0, fn: 0 },
    demographics: { correct: 0, total: 0 },
    cc: { correct: 0, total: 0 }
  }
  
  let totalLatency = 0
  let resultsLog = []

  for (const tc of testCases) {
    console.log(`\n[Case ${tc.id}] ${tc.description}`)
    const start = Date.now()
    let sce = null
    try {
      sce = await extractSymptomsFromHistory(tc.messages, symptomsList)
    } catch (err) {
      console.error(`Case ${tc.id} failed due to timeout/error:`, err.message)
      resultsLog.push(`Case ${tc.id}: FAILED - ${err.message}`)
      continue
    }
    const latency = Date.now() - start
    totalLatency += latency
    
    const extractedConfirmed = sce.symptoms.filter(s => s.status === 'positive').map(s => s.symptomId)
    const extractedExcluded = sce.symptoms.filter(s => s.status === 'negative').map(s => s.symptomId)
    const extractedCC = sce.symptoms.find(s => s.role === 'chief_complaint' && s.status === 'positive')?.symptomId || null
    const extractedAge = sce.demographics?.age || null
    const extractedSex = sce.demographics?.sex || null

    console.log(`  Latency: ${latency}ms`)
    console.log(`  Extracted Confirmed:`, extractedConfirmed)
    console.log(`  Expected Confirmed: `, tc.expected.confirmed)
    console.log(`  Extracted Excluded: `, extractedExcluded)
    console.log(`  Expected Excluded:  `, tc.expected.excluded)

    // 1. Triệu chứng khẳng định (Confirmed)
    tc.expected.confirmed.forEach(exp => {
      if (extractedConfirmed.includes(exp)) metrics.confirmed.tp++
      else metrics.confirmed.fn++
    })
    extractedConfirmed.forEach(ext => {
      if (!tc.expected.confirmed.includes(ext)) metrics.confirmed.fp++
    })

    // 2. Triệu chứng phủ định (Excluded / Negation)
    tc.expected.excluded.forEach(exp => {
      if (extractedExcluded.includes(exp)) metrics.excluded.tp++
      else metrics.excluded.fn++
    })
    extractedExcluded.forEach(ext => {
      if (!tc.expected.excluded.includes(ext)) metrics.excluded.fp++
    })

    // 3. Demographics
    let ageMatch = extractedAge === tc.expected.age
    let sexMatch = (extractedSex ? extractedSex.toLowerCase() : null) === (tc.expected.sex ? tc.expected.sex.toLowerCase() : null)
    
    if (tc.expected.age !== null) {
      metrics.demographics.total++
      if (ageMatch) metrics.demographics.correct++
    }
    if (tc.expected.sex !== null) {
      metrics.demographics.total++
      if (sexMatch) metrics.demographics.correct++
    }

    // 4. Chief Complaint
    if (tc.expected.cc) {
      metrics.cc.total++
      if (extractedCC === tc.expected.cc) metrics.cc.correct++
    }

    resultsLog.push(`
Case ${tc.id}: ${tc.description}
- Latency: ${latency}ms
- Demographics: Expected(Age: ${tc.expected.age}, Sex: ${tc.expected.sex}) -> Extracted(Age: ${extractedAge}, Sex: ${extractedSex}) [${ageMatch && sexMatch ? 'PASS' : 'FAIL'}]
- Chief Complaint: Expected(${tc.expected.cc}) -> Extracted(${extractedCC}) [${extractedCC === tc.expected.cc ? 'PASS' : 'FAIL'}]
- Confirmed Symptoms: Expected(${tc.expected.confirmed.join(', ')}) -> Extracted(${extractedConfirmed.join(', ')})
- Excluded Symptoms: Expected(${tc.expected.excluded.join(', ')}) -> Extracted(${extractedExcluded.join(', ')})
`)
  }

  // Tính toán các chỉ số thống kê
  const calcF1 = (tp, fp, fn) => {
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    return { precision: precision * 100, recall: recall * 100, f1: f1 * 100 }
  }

  const confStats = calcF1(metrics.confirmed.tp, metrics.confirmed.fp, metrics.confirmed.fn)
  const exclStats = calcF1(metrics.excluded.tp, metrics.excluded.fp, metrics.excluded.fn)
  
  const demoAccuracy = metrics.demographics.total > 0 ? (metrics.demographics.correct / metrics.demographics.total) * 100 : 0
  const ccAccuracy = metrics.cc.total > 0 ? (metrics.cc.correct / metrics.cc.total) * 100 : 0
  const avgLatency = totalLatency / testCases.length

  const reportText = `=============================================================
METRIC REPORT: CLINICAL NLP & CDSS (SCE EVALUATION)
=============================================================
Average Latency: ${avgLatency.toFixed(2)} ms

Confirmed Symptoms (Triệu chứng khẳng định):
- Precision: ${confStats.precision.toFixed(2)}%
- Recall:    ${confStats.recall.toFixed(2)}%
- F1-Score:  ${confStats.f1.toFixed(2)}%

Negation Detection (Triệu chứng phủ định):
- Precision: ${exclStats.precision.toFixed(2)}%
- Recall:    ${exclStats.recall.toFixed(2)}%
- F1-Score:  ${exclStats.f1.toFixed(2)}%

Demographics Match Accuracy: ${demoAccuracy.toFixed(2)}% (${metrics.demographics.correct}/${metrics.demographics.total})
Chief Complaint Match Accuracy: ${ccAccuracy.toFixed(2)}% (${metrics.cc.correct}/${metrics.cc.total})

=============================================================
DETAILED CASE EXECUTION LOGS
=============================================================
${resultsLog.join('\n')}
`

  console.log(reportText)
  
  // Lưu báo cáo kết quả kiểm thử vào thư mục tests
  const testsDir = path.join(process.cwd(), 'tests')
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true })
  }
  fs.writeFileSync(path.join(testsDir, 'test_results_quantitative.txt'), reportText, 'utf-8')
  console.log(`Saved evaluation report to ${path.join(testsDir, 'test_results_quantitative.txt')}`)
  process.exit(0)
}

runQuantitativeTest()
