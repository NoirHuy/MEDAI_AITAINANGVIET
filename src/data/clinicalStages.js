export const CLINICAL_STAGES = {
  intake: {
    vi: 'Đang tiếp nhận và phân tích thông tin bệnh nhân...',
    en: 'Analyzing patient response & intake data...',
  },
  extracting: {
    vi: 'Đang bóc tách triệu chứng và yếu tố nguy cơ...',
    en: 'Extracting clinical symptoms & attributes...',
  },
  graph_query: {
    vi: 'Đang đối chiếu đồ thị tri thức y khoa Neo4j & UMLS...',
    en: 'Querying Neo4j medical knowledge graph...',
  },
  evaluating: {
    vi: 'Đang đánh giá xác suất bệnh lý và định hướng sàng lọc...',
    en: 'Evaluating disease probabilities & clinical paths...',
  },
  composing: {
    vi: 'MedChat247 đang soạn thảo tư vấn lâm sàng...',
    en: 'MedChat247 is composing clinical consultation response...',
  },
}

export const CLINICAL_STAGE_KEYS = ['intake', 'extracting', 'graph_query', 'evaluating', 'composing']

export function getClinicalStageText(stageKey, lang = 'vi') {
  const stage = CLINICAL_STAGES[stageKey] || CLINICAL_STAGES.intake
  return lang === 'en' ? stage.en : stage.vi
}
