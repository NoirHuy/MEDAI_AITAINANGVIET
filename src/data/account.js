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
    price: '0đ',
    priceDetail: '/tháng',
    tokenLimit: 50000,
    features: [
      'Tư vấn không giới hạn số cuộc trò chuyện',
      '50.000 token phản hồi AI mỗi tháng',
      'Truy cập 4 chuyên khoa cơ bản',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '99.000đ',
    priceDetail: '/tháng',
    tokenLimit: 2000000,
    features: [
      'Toàn bộ tính năng của gói Free',
      '2.000.000 token phản hồi AI mỗi tháng',
      'Ưu tiên tốc độ phản hồi',
      'Truy cập sớm các chuyên khoa mới',
    ],
  },
]

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0]
}
