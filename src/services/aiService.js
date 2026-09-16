import { apiUrl } from './api'

export async function fetchSmartTitle(text, lang = 'vi') {
  try {
    const res = await fetch(apiUrl('/api/chat/generate-title'), {
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

export async function streamAssistantReply({ messages, specialtyId, lang, isSuggestionDemo, suggestionId, conversationId, signal, onToken, onStatus }) {
  try {
    return await streamFromBackend({ messages, specialtyId, lang, isSuggestionDemo, suggestionId, conversationId, signal, onToken, onStatus })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    console.warn('Chat API unavailable:', err)

    if (err.customMessage) {
      onToken?.(err.customMessage)
      return err.customMessage
    }

    const message = lang === 'en'
      ? 'The medical consultation service is temporarily unavailable. If you have severe or worsening symptoms, contact local emergency services or seek urgent in-person care.'
      : 'Dịch vụ tư vấn y tế hiện tạm thời không khả dụng. Nếu bạn có triệu chứng nặng hoặc diễn tiến xấu, hãy gọi cấp cứu địa phương hoặc đến cơ sở y tế gần nhất.'
    onToken?.(message)
    return message
  }
}

function getGuestSessionId() {
  try {
    let id = localStorage.getItem('medai_guest_id')
    if (!id) {
      id = 'g_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
      localStorage.setItem('medai_guest_id', id)
    }
    return id
  } catch {
    return ''
  }
}

async function streamFromBackend({ messages, specialtyId, lang, isSuggestionDemo, suggestionId, conversationId, signal, onToken, onStatus }) {
  const headers = { 'Content-Type': 'application/json' }
  const guestId = getGuestSessionId()
  if (guestId) {
    headers['X-Guest-Session-ID'] = guestId
  }

  const res = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers,
    credentials: 'include',
    signal,
    body: JSON.stringify({ messages, specialtyId, lang, isSuggestionDemo, suggestionId, conversationId }),
  })

  if (!res.ok) {
    let errorMsg = ''
    try {
      const data = await res.json()
      errorMsg = data?.error || data?.message
    } catch {
      // ignore JSON parse error
    }
    const err = new Error(errorMsg || `Chat API request failed (${res.status})`)
    err.status = res.status
    err.customMessage = errorMsg
    throw err
  }

  if (!res.body) throw new Error('Chat API response body is empty')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let pendingBuffer = ''
  // Strip server-side control sequences so they never flash as raw text during streaming.
  // They're still accumulated in `full` and parsed by MessageBubble after streaming ends.
  const CONTROL_MARKER_RE = /(__MEMORIES_USED__:[\s\S]*$|\[SymptomChecklist:[\s\S]*?\])/g

  const emitVisible = (text) => {
    if (!onToken || !text) return
    const visible = text.replace(CONTROL_MARKER_RE, '')
    if (visible) onToken(visible)
  }

  const processChunkText = (text) => {
    const combined = pendingBuffer + text
    pendingBuffer = ''

    // Match all complete __STATUS__:<stage>\n
    const STATUS_RE = /__STATUS__:([a-zA-Z0-9_]+)\n/g
    let lastIndex = 0
    let match
    let visibleAccum = ''

    while ((match = STATUS_RE.exec(combined)) !== null) {
      const before = combined.slice(lastIndex, match.index)
      if (before) visibleAccum += before
      onStatus?.(match[1])
      lastIndex = match.index + match[0].length
    }

    const remainder = combined.slice(lastIndex)
    if (remainder.startsWith('__STATUS__') || '__STATUS__'.startsWith(remainder)) {
      pendingBuffer = remainder
    } else {
      visibleAccum += remainder
    }

    if (visibleAccum) {
      full += visibleAccum
      emitVisible(visibleAccum)
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      if (!chunk) continue
      processChunkText(chunk)
    }

    const finalChunk = decoder.decode()
    if (finalChunk) {
      processChunkText(finalChunk)
    }
    if (pendingBuffer) {
      if (!pendingBuffer.startsWith('__STATUS__')) {
        full += pendingBuffer
        emitVisible(pendingBuffer)
      }
      pendingBuffer = ''
    }
  } finally {
    reader.releaseLock()
  }
  return full
}
