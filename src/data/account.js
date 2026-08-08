// A single demo Google account offered by the mocked account chooser in
// AuthModal — stands in for the real accounts Google's OAuth popup would list.
export const MOCK_GOOGLE_ACCOUNT = {
  name: 'Trần Thị Demo',
  email: 'demo.tran@gmail.com',
}

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: { vi: '0đ', en: '$0' },
    priceDetail: { vi: '/tháng', en: '/month' },
    tokenLimit: 50000,
    features: {
      vi: [
        'Tư vấn không giới hạn số cuộc trò chuyện',
        '50.000 token phản hồi AI mỗi tháng',
        'Truy cập 4 chuyên khoa cơ bản',
      ],
      en: [
        'Unlimited medical conversation turns',
        '50,000 AI response tokens per month',
        'Access to 4 essential medical specialties',
      ],
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { vi: '99.000đ', en: '$3.99' },
    priceDetail: { vi: '/tháng', en: '/month' },
    tokenLimit: 2000000,
    features: {
      vi: [
        'Toàn bộ tính năng của gói Free',
        '2.000.000 token phản hồi AI mỗi tháng',
        'Ưu tiên tốc độ phản hồi tối đa',
        'Truy cập sớm các chuyên khoa mới',
      ],
      en: [
        'All features included in Free plan',
        '2,000,000 AI response tokens per month',
        'Maximum AI response speed priority',
        'Early access to new medical specialties',
      ],
    },
  },
]

export function getPlan(planId, lang = 'vi') {
  const p = PLANS.find((item) => item.id === planId) ?? PLANS[0]
  return {
    ...p,
    price: typeof p.price === 'object' ? (p.price[lang] || p.price.vi) : p.price,
    priceDetail: typeof p.priceDetail === 'object' ? (p.priceDetail[lang] || p.priceDetail.vi) : p.priceDetail,
    features: Array.isArray(p.features) ? p.features : (p.features[lang] || p.features.vi),
  }
}
