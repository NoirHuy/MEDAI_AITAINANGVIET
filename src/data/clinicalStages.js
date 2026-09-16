export const CLINICAL_STAGES = [
  {
    delay: 0,
    vi: 'Đang tiếp nhận và phân tích thông tin bệnh nhân...',
    en: 'Analyzing patient response & intake data...',
  },
  {
    delay: 2000,
    vi: 'Đang bóc tách triệu chứng và yếu tố nguy cơ...',
    en: 'Extracting clinical symptoms & attributes...',
  },
  {
    delay: 4500,
    vi: 'Đang đối chiếu đồ thị tri thức y khoa Neo4j & UMLS...',
    en: 'Querying Neo4j medical knowledge graph...',
  },
  {
    delay: 6500,
    vi: 'Đang đánh giá xác suất bệnh lý và định hướng sàng lọc...',
    en: 'Evaluating disease probabilities & clinical paths...',
  },
  {
    delay: 8500,
    vi: 'MedChat247 đang soạn thảo tư vấn lâm sàng...',
    en: 'MedChat247 is composing clinical consultation response...',
  },
]
