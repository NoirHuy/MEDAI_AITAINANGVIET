import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '../utils/id'
import { streamAssistantReply, fetchSmartTitle } from '../services/aiService'
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
  const cleaned = text
    .replace(/\[.*?\]/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= 25) return cleaned
  return `${cleaned.slice(0, 25)}…`
}

export function useChat(account) {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(() => localStorage.getItem('medai_active_chat_id') || null)
  const [isResponding, setIsResponding] = useState(false)
  const abortRef = useRef(null)

  // Lưu activeId vào state & localStorage (chỉ khi có id hợp lệ)
  const setActiveIdAndPersist = useCallback((id) => {
    setActiveId(id)
    if (id) {
      localStorage.setItem('medai_active_chat_id', id)
    } else {
      localStorage.removeItem('medai_active_chat_id')
    }
  }, [])

  // Load conversations từ MongoDB khi tài khoản đã xác thực
  useEffect(() => {
    if (!account) {
      setConversations([])
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
            const savedId = localStorage.getItem('medai_active_chat_id')
            const exists = data.conversations.some((c) => c.id === savedId)
            if (savedId && exists) {
              setActiveId(savedId)
            } else {
              setActiveIdAndPersist(data.conversations[0].id)
            }
          }
        }
      })
      .catch((err) => {
        console.error('Không thể tải lịch sử trò chuyện:', err)
      })

    return () => {
      cancelled = true
    }
  }, [account, setActiveIdAndPersist])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  const startNewConversation = useCallback((specialtyId) => {
    const conv = makeConversation(specialtyId)
    setConversations((prev) => [conv, ...prev])
    setActiveIdAndPersist(conv.id)
    return conv.id
  }, [setActiveIdAndPersist])

  const selectConversation = useCallback((id) => {
    setActiveIdAndPersist(id)
  }, [setActiveIdAndPersist])

  const deleteConversation = useCallback((id) => {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id)
      const currentSaved = localStorage.getItem('medai_active_chat_id')
      if (currentSaved === id) {
        const nextActive = remaining.length > 0 ? remaining[0].id : null
        setActiveIdAndPersist(nextActive)
      }
      return remaining
    })
    if (account) {
      fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' }).catch((err) =>
        console.error('Không thể xóa cuộc trò chuyện:', err),
      )
    }
  }, [account, setActiveIdAndPersist])

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
    async (text, specialtyIdForNew, lang = 'vi', isDemo = false) => {
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
        setActiveIdAndPersist(convId)
      }

      const userMessage = { id: createId(), role: 'user', content: trimmed }
      const assistantId = createId()
      const assistantMessage = { id: assistantId, role: 'assistant', content: '', streaming: true }
      const messagesForApi = [...baseMessages, userMessage]

      // Thêm cuộc hội thoại và tin nhắn đồng bộ vào state
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === convId)
        if (!exists) {
          const newConv = {
            id: convId,
            title: titleFromText(trimmed),
            specialtyId,
            messages: [userMessage, assistantMessage],
            createdAt: Date.now(),
          }
          return [newConv, ...prev]
        }

        return prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: c.messages.length === 0 ? titleFromText(trimmed) : c.title,
                messages: [...c.messages, userMessage, assistantMessage],
              }
            : c,
        )
      })

      // Nếu là câu thoại đầu tiên của đoạn chat, tự động tạo tiêu đề ChatGPT súc tích
      if (baseMessages.length === 0) {
        const targetConvId = convId
        fetchSmartTitle(trimmed, lang).then((smartTitle) => {
          if (smartTitle) {
            setConversations((prev) =>
              prev.map((c) => (c.id === targetConvId ? { ...c, title: smartTitle } : c)),
            )
          }
        })
      }

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
          isSuggestionDemo: isDemo,
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
    [activeId, activeConversation, isResponding, account, setActiveIdAndPersist],
  )

  return {
    conversations,
    activeId,
    activeConversation,
    isResponding,
    sendMessage,
    stopResponding,
    startNewConversation,
    selectConversation,
    deleteConversation,
    setSpecialty,
  }
}
