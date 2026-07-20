import { SPECIALTIES } from '../data/specialties'

// Nullish (not ||) so an explicitly empty string means "same origin" (the
// production Docker setup proxies /api/* through nginx to the backend) —
// falling through to the dev default only when the var is unset entirely.
const envApiUrl = import.meta.env.VITE_API_URL
const API_URL = (envApiUrl && envApiUrl !== 'http://localhost:4000')
  ? envApiUrl
  : (import.meta.env.DEV ? 'http://localhost:4000' : '')

// Simulated "thinking" delay before the first token arrives, in ms.
const THINKING_DELAY_RANGE = [500, 1100]
// Simulated per-word streaming delay, in ms.
const TOKEN_DELAY_RANGE = [16, 45]

/**
 * Streams an assistant reply for the given conversation from the backend
 * (see back_end/src/routes/chat.routes.js). Falls back to a local mock
 * reply if the backend can't be reached, so the UI still works if you
 * haven't started it — see back_end/README-equivalent setup notes.
 *
 * @param {Object} params
 * @param {{role: 'user'|'assistant', content: string}[]} params.messages - full conversation so far
 * @param {string} params.specialtyId - selected specialty id (see src/data/specialties.js)
 * @param {AbortSignal} [params.signal] - abort the in-flight response (e.g. user hits "stop")
 * @param {(chunk: string) => void} [params.onToken] - called with each incremental chunk of text
 * @returns {Promise<string>} the full reply text
 */
export async function streamAssistantReply({ messages, specialtyId, lang, signal, onToken }) {
  try {
    return await streamFromBackend({ messages, specialtyId, lang, signal, onToken })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    console.warn('Chat API unreachable, falling back to local mock reply:', err)
    return mockStream({ messages, specialtyId, signal, onToken })
  }
}

async function streamFromBackend({ messages, specialtyId, lang, signal, onToken }) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify({ messages, specialtyId, lang }),
  })
  if (!res.ok || !res.body) throw new Error(`Chat API request failed (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onToken?.(chunk)
  }
  return full
}

async function mockStream({ messages, specialtyId, signal, onToken }) {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  const reply = buildMockReply(lastUserMessage?.content ?? '', specialtyId)

  await wait(randomBetween(...THINKING_DELAY_RANGE), signal)

  const chunks = reply.split(/(\s+)/).filter((c) => c.length > 0)
  let full = ''
  for (const chunk of chunks) {
    full += chunk
    onToken?.(chunk)
    await wait(randomBetween(...TOKEN_DELAY_RANGE), signal)
  }
  return full
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

const KEYWORD_RULES = [
  {
    keywords: ['đau đầu', 'nhức đầu', 'sốt'],
    reply: (specialty) =>
      `Đau đầu kèm sốt nhẹ thường gặp trong nhiễm virus đường hô hấp, nhưng cũng có thể do nhiều nguyên nhân khác. Một vài gợi ý ban đầu:\n\n` +
      `1. Nghỉ ngơi, uống đủ nước, có thể dùng paracetamol theo liều khuyến cáo để hạ sốt và giảm đau.\n` +
      `2. Theo dõi nhiệt độ mỗi 4–6 giờ, ghi lại các triệu chứng đi kèm (buồn nôn, cứng cổ, phát ban, sợ ánh sáng).\n` +
      `3. Nên đi khám sớm nếu: sốt trên 39°C không hạ, đau đầu dữ dội đột ngột, cứng gáy, lú lẫn, hoặc sốt kéo dài quá 3 ngày.\n\n` +
      `Bạn có thể mô tả thêm: cơn đau xuất hiện từ khi nào, có kèm buồn nôn hay nhạy cảm ánh sáng không, để mình gợi ý phù hợp hơn theo hướng ${specialty.name.toLowerCase()}?`,
  },
  {
    keywords: ['tác dụng phụ', 'thuốc', 'paracetamol', 'liều dùng'],
    reply: () =>
      `Về thuốc paracetamol (acetaminophen):\n\n` +
      `- Tác dụng phụ thường gặp: hiếm khi xảy ra ở liều điều trị thông thường, nhưng dùng quá liều có thể gây tổn thương gan nghiêm trọng.\n` +
      `- Liều tối đa khuyến cáo cho người lớn thường là 3–4g/ngày (tùy hướng dẫn địa phương), chia làm nhiều lần, cách nhau tối thiểu 4–6 giờ.\n` +
      `- Cần thận trọng nếu bạn có bệnh gan, uống rượu bia thường xuyên, hoặc đang dùng thuốc khác có chứa paracetamol để tránh quá liều cộng dồn.\n\n` +
      `Đây chỉ là thông tin tham khảo chung — liều dùng cụ thể nên theo hướng dẫn trên bao bì hoặc chỉ định của dược sĩ/bác sĩ.`,
  },
  {
    keywords: ['tiểu đường', 'đường huyết', 'thực đơn', 'dinh dưỡng', 'ăn uống'],
    reply: () =>
      `Gợi ý nguyên tắc xây dựng thực đơn cho người tiểu đường type 2:\n\n` +
      `- Ưu tiên tinh bột hấp thu chậm: gạo lứt, yến mạch, khoai lang thay vì gạo trắng, bánh mì trắng.\n` +
      `- Tăng rau xanh và chất xơ trong mỗi bữa ăn để làm chậm hấp thu đường.\n` +
      `- Chọn đạm nạc: cá, ức gà, đậu phụ; hạn chế mỡ động vật và đồ chiên rán.\n` +
      `- Chia nhỏ bữa ăn (4–5 bữa/ngày) để tránh đường huyết dao động mạnh.\n` +
      `- Hạn chế nước ngọt, bánh kẹo, trái cây quá ngọt; ưu tiên trái cây ít đường như bưởi, táo, ổi (ăn vừa phải).\n\n` +
      `Thực đơn cụ thể nên được điều chỉnh theo cân nặng, mức đường huyết hiện tại và các bệnh lý đi kèm — bạn nên trao đổi với bác sĩ dinh dưỡng để có kế hoạch cá nhân hóa.`,
  },
  {
    keywords: ['xét nghiệm', 'hba1c', 'đường huyết lúc đói', 'chỉ số'],
    reply: () =>
      `Hai chỉ số này thường dùng để đánh giá và theo dõi tiểu đường:\n\n` +
      `- Đường huyết lúc đói: đo sau khi nhịn ăn ít nhất 8 giờ. Bình thường: dưới 100 mg/dL; 100–125 mg/dL gợi ý tiền tiểu đường; từ 126 mg/dL trở lên (đo lặp lại) gợi ý tiểu đường.\n` +
      `- HbA1c: phản ánh mức đường huyết trung bình trong 2–3 tháng gần nhất. Bình thường: dưới 5.7%; 5.7–6.4% là tiền tiểu đường; từ 6.5% trở lên gợi ý tiểu đường.\n\n` +
      `Kết quả cần được bác sĩ đọc cùng với bệnh sử và các xét nghiệm khác để đưa ra kết luận chính xác, vì chỉ số đơn lẻ không phản ánh đầy đủ tình trạng sức khỏe.`,
  },
  {
    keywords: ['ho', 'cảm cúm', 'sổ mũi', 'viêm họng'],
    reply: () =>
      `Với triệu chứng ho, sổ mũi, đau họng (thường gặp trong cảm cúm thông thường):\n\n` +
      `1. Nghỉ ngơi, giữ ấm, uống nhiều nước ấm, có thể dùng mật ong - chanh ấm để dịu họng.\n` +
      `2. Súc miệng nước muối ấm giúp giảm đau họng.\n` +
      `3. Có thể dùng thuốc giảm triệu chứng (hạ sốt, giảm ho) theo hướng dẫn nếu cần.\n\n` +
      `Nên đi khám nếu: sốt cao kéo dài, khó thở, đau ngực, ho ra máu, hoặc triệu chứng không cải thiện sau 7–10 ngày.`,
  },
  {
    keywords: ['da', 'dị ứng', 'mẩn ngứa', 'nổi mề đay', 'mụn'],
    reply: () =>
      `Với các vấn đề về da như mẩn ngứa, nổi mề đay hoặc mụn:\n\n` +
      `- Tránh gãi hoặc chà xát vùng da tổn thương để hạn chế nhiễm trùng.\n` +
      `- Xác định và tránh tác nhân nghi ngờ gây dị ứng (thức ăn, mỹ phẩm, thời tiết, hóa chất).\n` +
      `- Có thể chườm mát và dùng kem dưỡng ẩm dịu nhẹ, không mùi hương để giảm kích ứng.\n\n` +
      `Nếu mẩn ngứa lan rộng nhanh, kèm khó thở, sưng môi/mặt, đây có thể là phản ứng dị ứng nặng — cần đến cơ sở y tế ngay lập tức.`,
  },
  {
    keywords: ['đau bụng', 'dạ dày', 'buồn nôn', 'tiêu chảy'],
    reply: () =>
      `Với đau bụng vùng dạ dày kèm buồn nôn:\n\n` +
      `- Ăn nhẹ, tránh đồ cay nóng, nhiều dầu mỡ, rượu bia và cà phê trong lúc này.\n` +
      `- Chia nhỏ bữa ăn, ăn chậm, tránh nằm ngay sau khi ăn.\n` +
      `- Có thể dùng thuốc kháng acid không kê đơn nếu nghi ngờ do dạ dày, nhưng nên thận trọng nếu triệu chứng lặp lại thường xuyên.\n\n` +
      `Cần đi khám sớm nếu: đau dữ dội đột ngột, nôn ra máu, phân đen, sụt cân không rõ nguyên nhân, hoặc đau kéo dài trên vài ngày.`,
  },
  {
    keywords: ['trẻ em', 'trẻ nhỏ', 'em bé', 'con tôi'],
    reply: () =>
      `Với trẻ nhỏ, các dấu hiệu cần theo dõi sát và đưa đi khám sớm hơn người lớn bao gồm: sốt cao trên 39°C không đáp ứng thuốc hạ sốt, bỏ bú/bỏ ăn, li bì khó đánh thức, thở nhanh/khó thở, phát ban bất thường, hoặc co giật.\n\n` +
      `Với trẻ sơ sinh dưới 3 tháng tuổi, bất kỳ dấu hiệu sốt nào cũng nên được bác sĩ nhi khoa đánh giá ngay, vì trẻ ở độ tuổi này có thể diễn tiến nhanh.\n\n` +
      `Bạn có thể cho mình biết bé bao nhiêu tuổi và triệu chứng cụ thể để mình tư vấn kỹ hơn không?`,
  },
  {
    keywords: ['mất ngủ', 'stress', 'căng thẳng', 'lo âu', 'áp lực'],
    reply: () =>
      `Mất ngủ do căng thẳng, lo âu khá phổ biến. Một số cách hỗ trợ cải thiện giấc ngủ:\n\n` +
      `- Giữ giờ ngủ - thức cố định mỗi ngày, kể cả cuối tuần.\n` +
      `- Hạn chế caffeine, rượu bia và màn hình điện thoại/máy tính ít nhất 1 giờ trước khi ngủ.\n` +
      `- Thử các kỹ thuật thư giãn: hít thở sâu, thiền, hoặc vận động nhẹ vào ban ngày.\n` +
      `- Nếu lo âu ảnh hưởng nhiều đến cuộc sống hằng ngày và kéo dài, nên trao đổi với chuyên gia tâm lý hoặc bác sĩ để được hỗ trợ phù hợp.`,
  },
]

const GENERIC_REPLIES = [
  (specialty) =>
    `Cảm ơn bạn đã chia sẻ. Để tư vấn chính xác hơn theo hướng ${specialty.name.toLowerCase()}, bạn có thể cho mình biết thêm: triệu chứng bắt đầu từ khi nào, mức độ nghiêm trọng, và có yếu tố nào làm triệu chứng nặng hơn hoặc nhẹ hơn không?\n\n` +
    `Trong lúc chờ thêm thông tin, một số nguyên tắc chung là: theo dõi triệu chứng, nghỉ ngơi đầy đủ, uống đủ nước, và đi khám nếu triệu chứng nặng lên hoặc kéo dài bất thường.`,
  (specialty) =>
    `Mình đã ghi nhận thông tin bạn cung cấp. Đây là một số điểm bạn nên lưu ý:\n\n` +
    `1. Theo dõi các triệu chứng đi kèm để phát hiện sớm dấu hiệu bất thường.\n` +
    `2. Ghi chú thời gian, tần suất và mức độ để cung cấp cho bác sĩ nếu cần khám trực tiếp.\n` +
    `3. Tránh tự ý dùng thuốc kéo dài mà không có chỉ định.\n\n` +
    `Bạn có thể mô tả chi tiết hơn để mình hỗ trợ tư vấn ${specialty.name.toLowerCase()} sát hơn với tình trạng của bạn.`,
]

function buildMockReply(userText, specialtyId) {
  const specialty = SPECIALTIES.find((s) => s.id === specialtyId) ?? SPECIALTIES[0]
  const lower = userText.toLowerCase()

  const matched = KEYWORD_RULES.find((rule) => rule.keywords.some((k) => lower.includes(k)))
  if (matched) return matched.reply(specialty)

  const fallback = GENERIC_REPLIES[Math.floor(Math.random() * GENERIC_REPLIES.length)]
  return fallback(specialty)
}
