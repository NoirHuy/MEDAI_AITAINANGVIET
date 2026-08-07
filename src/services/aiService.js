// Explicitly empty VITE_API_URL means same-origin production API. In local
// development, use the separately-running backend service by default.
const envApiUrl = import.meta.env.VITE_API_URL
const API_URL = (envApiUrl && envApiUrl !== 'http://localhost:4000')
  ? envApiUrl
  : (import.meta.env.DEV ? 'http://localhost:4000' : '')

export async function fetchSmartTitle(text, lang = 'vi') {
  try {
    const res = await fetch(`${API_URL}/api/chat/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.title) return data.title
    }
  } catch (err) {
    console.warn('Failed to fetch smart title:', err)
  }
  return text.trim().slice(0, 30)
}

export async function streamAssistantReply({ messages, specialtyId, lang, isSuggestionDemo, signal, onToken }) {
  try {
    return await streamFromBackend({ messages, specialtyId, lang, isSuggestionDemo, signal, onToken })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    console.warn('Chat API unavailable:', err)
    const message = lang === 'en'
      ? 'The medical consultation service is temporarily unavailable. If you have severe or worsening symptoms, contact local emergency services or seek urgent in-person care.'
      : 'Dịch vụ tư vấn y tế hiện tạm thời không khả dụng. Nếu bạn có triệu chứng nặng hoặc diễn tiến xấu, hãy gọi cấp cứu địa phương hoặc đến cơ sở y tế gần nhất.'
    onToken?.(message)
    return message
  }
}

async function streamFromBackend({ messages, specialtyId, lang, isSuggestionDemo, signal, onToken }) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify({ messages, specialtyId, lang, isSuggestionDemo }),
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
