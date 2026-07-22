export const SUGGESTIONS = [
  {
    id: 'suggestion_1',
    isDemo: true, // Thẻ Demo đặc biệt: Ép xuất Báo cáo Kết luận Phase 2 ngay lượt 1
    title: {
      vi: 'Xem ngay Báo cáo Sàng lọc Kết luận (Demo mẫu)',
      en: 'View Instant Screening Report (Demo)'
    },
    detail: {
      vi: 'Xem trực tiếp giao diện Báo cáo Sàng lọc Chẩn đoán Y khoa đầy đủ.',
      en: 'Instantly view a complete medical diagnostic screening report.'
    },
    prompt: {
      vi: 'Tôi là nam 25 tuổi, bị sốt 38.5 độ kèm đau rát họng khi nuốt 2 ngày nay, nhìn họng thấy 2 bên amidan đỏ rực, cảm giác nuốt vướng và mệt mỏi nhiều. Tôi không bị ho, không bị nghẹt mũi hay chảy nước mũi.',
      en: 'I am a 25-year-old male with a 38.5°C fever and severe sore throat when swallowing for 2 days, bright red tonsils, and fatigue. I do not have a cough, nasal congestion, or runny nose.'
    },
  },
  {
    id: 'suggestion_2',
    isDemo: false, // Thẻ Quy trình: Đi qua luồng hỏi đáp từng bước bình thường
    title: {
      vi: 'Trải nghiệm quy trình AI hỏi bệnh thông minh',
      en: 'Experience Intelligent AI Symptom Interview'
    },
    detail: {
      vi: 'Mô tả triệu chứng ban đầu để AI đặt câu hỏi làm rõ từng bước.',
      en: 'Describe initial symptoms and let AI ask clarifying questions step-by-step.'
    },
    prompt: {
      vi: 'Tôi là nam 22 tuổi, bị đau bụng từ sáng nay kèm sốt nhẹ và chán ăn, hãy hỏi thêm để giúp tôi tìm nguyên nhân.',
      en: 'I am a 22-year-old male experiencing abdominal pain since this morning with a mild fever and loss of appetite. Please ask follow-up questions to help find the cause.'
    },
  },
]