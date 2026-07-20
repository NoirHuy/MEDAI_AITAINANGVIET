import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '../utils/id'
import { streamAssistantReply } from '../services/aiService'
import { DEFAULT_SPECIALTY_ID } from '../data/specialties'

function makeConversation(specialtyId = DEFAULT_SPECIALTY_ID) {
  return {
    id: createId(),
    title: 'Cuộc trò chuyện mới',
    specialtyId,
    messages: [],
    createdAt: Date.now(),
  }
}

function titleFromText(text) {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 42) return trimmed
  return `${trimmed.slice(0, 42)}…`
}

export function useChat(account) {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [isResponding, setIsResponding] = useState(false)
  const abortRef = useRef(null)

  // Load conversations from MongoDB when logged in
  useEffect(() => {
    if (!account) {
      setConversations([])
      setActiveId(null)
      return
    }

    let cancelled = false
    fetch('/api/chat/conversations')
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        if (!cancelled && data.conversations) {
          setConversations(data.conversations)
          if (data.conversations.length > 0) {
            setActiveId(data.conversations[0].id)
          }
        }
      })
      .catch((err) => {
        console.error('Không thể tải lịch sử trò chuyện:', err)
      })

    return () => {
      cancelled = true
    }
  }, [account])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  const startNewConversation = useCallback((specialtyId) => {
    const conv = makeConversation(specialtyId)
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.id)
    return conv.id
  }, [])

  const selectConversation = useCallback((id) => {
    setActiveId(id)
  }, [])

  const deleteConversation = useCallback((id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    setActiveId((current) => (current === id ? null : current))
    if (account) {
      fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' }).catch((err) =>
        console.error('Không thể xóa cuộc trò chuyện:', err),
      )
    }
  }, [account])

  const setSpecialty = useCallback((convId, specialtyId) => {
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === convId ? { ...c, specialtyId } : c))
      if (account) {
        const conv = updated.find((c) => c.id === convId)
        if (conv) {
          fetch('/api/chat/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: conv.id,
              title: conv.title,
              specialtyId: conv.specialtyId,
              messages: conv.messages,
            }),
          }).catch((err) => console.error('Không thể lưu chuyên khoa:', err))
        }
      }
      return updated
    })
  }, [account])

  const stopResponding = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(
    async (text, specialtyIdForNew, lang = 'vi') => {
      const trimmed = text.trim()
      if (!trimmed || isResponding) return

      let convId = activeId
      let baseMessages = activeConversation?.messages ?? []
      let specialtyId = activeConversation?.specialtyId ?? specialtyIdForNew ?? DEFAULT_SPECIALTY_ID

      if (!convId) {
        const conv = makeConversation(specialtyIdForNew)
        convId = conv.id
        specialtyId = conv.specialtyId
        baseMessages = []
        setConversations((prev) => [conv, ...prev])
        setActiveId(convId)
      }

      const userMessage = { id: createId(), role: 'user', content: trimmed }
      const messagesForApi = [...baseMessages, userMessage]

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: c.messages.length === 0 ? titleFromText(trimmed) : c.title,
                messages: [...c.messages, userMessage],
              }
            : c,
        ),
      )

      const assistantId = createId()
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: assistantId, role: 'assistant', content: '', streaming: true },
                ],
              }
            : c,
        ),
      )

      const controller = new AbortController()
      abortRef.current = controller
      setIsResponding(true)

      const appendToken = (chunk) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + chunk } : m,
                  ),
                }
              : c,
          ),
        )
      }

      try {
        await streamAssistantReply({
          messages: messagesForApi,
          specialtyId,
          lang,
          signal: controller.signal,
          onToken: appendToken,
        })
      } catch (err) {
        if (err?.name !== 'AbortError') {
          appendToken(lang === 'en' ? '\n\n_An error occurred while fetching the response. Please try again._' : '\n\n_Đã xảy ra lỗi khi lấy phản hồi. Vui lòng thử lại._')
        }
      } finally {
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, streaming: false } : m,
                  ),
                }
              : c,
          )

          if (account) {
            const conv = updated.find((c) => c.id === convId)
            if (conv) {
              fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: conv.id,
                  title: conv.title,
                  specialtyId: conv.specialtyId,
                  messages: conv.messages,
                }),
              }).catch((err) => console.error('Không thể lưu cuộc trò chuyện:', err))
            }
          }

          return updated
        })
        setIsResponding(false)
        abortRef.current = null
      }
    },
    [activeId, activeConversation, isResponding, account],
  )

  return {
    conversations,
    activeConversation,
    activeId,
    isResponding,
    startNewConversation,
    selectConversation,
    deleteConversation,
    setSpecialty,
    sendMessage,
    stopResponding,
  }
}
