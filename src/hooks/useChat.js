import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '../utils/id'
import { streamAssistantReply, fetchSmartTitle } from '../services/aiService'
import { apiUrl } from '../services/api'
import { DEFAULT_SPECIALTY_ID } from '../data/specialties'

const ACTIVE_CHAT_STORAGE_KEY = 'medai_active_chat_id'

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
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || null)
  const [isResponding, setIsResponding] = useState(false)
  const abortRef = useRef(null)
  // Mirror of the latest conversations state so async callbacks can read fresh
  // data without performing side effects inside setState updaters (which
  // double-fire under React StrictMode).
  const conversationsRef = useRef(conversations)
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const activeIdRef = useRef(activeId)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const prevAccountRef = useRef(account)

  // Abort any in-flight stream when the hook unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Lưu activeId vào state & localStorage (chỉ khi có id hợp lệ)
  const setActiveIdAndPersist = useCallback((id) => {
    setActiveId(id)
    if (id) {
      localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, id)
    } else {
      localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY)
    }
  }, [])

  // Load conversations từ MongoDB khi tài khoản đã xác thực
  useEffect(() => {
    const prevAccount = prevAccountRef.current
    prevAccountRef.current = account

    if (!account) {
      if (prevAccount) {
        // Đăng xuất: dọn sạch hội thoại tài khoản cũ và activeId
        setConversations([])
        conversationsRef.current = []
        setActiveIdAndPersist(null)
      }
      return
    }

    let cancelled = false
    fetch(apiUrl('/api/chat/conversations'), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data.conversations) return
        const serverList = data.conversations
        const currentLocal = conversationsRef.current || []

        // Tìm các cuộc trò chuyện cục bộ có nội dung chưa được lưu lên server (như khách chat trước khi login)
        const unsavedLocals = currentLocal.filter(
          (local) =>
            Array.isArray(local.messages) &&
            local.messages.some((m) => m.content && m.content.trim()) &&
            !serverList.some((s) => s.id === local.id),
        )

        // Tự động lưu các cuộc trò chuyện này vào tài khoản vừa đăng nhập trên MongoDB
        for (const conv of unsavedLocals) {
          const validMessages = (conv.messages || [])
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({ id: m.id, role: m.role, content: m.content }))

          if (validMessages.length > 0) {
            fetch(apiUrl('/api/chat/conversations'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                id: conv.id,
                title: conv.title || 'Cuộc trò chuyện mới',
                specialtyId: conv.specialtyId || DEFAULT_SPECIALTY_ID,
                messages: validMessages,
                lang: localStorage.getItem('medai_lang') || 'vi',
              }),
            }).catch((err) => console.error('Không thể lưu cuộc trò chuyện cục bộ:', err))
          }
        }

        // Hợp nhất danh sách: các hội thoại vừa tạo cục bộ lên trước, tiếp đến serverList
        // Nếu đã có trên server nhưng bản cục bộ có nhiều tin nhắn hơn, ưu tiên bản cục bộ
        const merged = [
          ...unsavedLocals,
          ...serverList.map((serverConv) => {
            const localMatch = currentLocal.find((c) => c.id === serverConv.id)
            if (localMatch && (localMatch.messages?.length ?? 0) > (serverConv.messages?.length ?? 0)) {
              return localMatch
            }
            return serverConv
          }),
        ]

        setConversations(merged)
        conversationsRef.current = merged

        // Đảm bảo activeId trỏ đúng cuộc trò chuyện
        const targetActive = activeIdRef.current || localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY)
        if (targetActive && merged.some((c) => c.id === targetActive)) {
          setActiveIdAndPersist(targetActive)
        } else if (merged.length > 0) {
          setActiveIdAndPersist(merged[0].id)
        } else {
          setActiveIdAndPersist(null)
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

  const persistConversation = useCallback((conv, lang) => {
    if (!account || !conv) return
    fetch(apiUrl('/api/chat/conversations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id: conv.id,
        title: conv.title,
        specialtyId: conv.specialtyId,
        messages: conv.messages,
        lang,
      }),
    }).catch((err) => console.error('Không thể lưu cuộc trò chuyện:', err))
  }, [account])

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
    const remaining = conversationsRef.current.filter((c) => c.id !== id)
    setConversations(remaining)
    conversationsRef.current = remaining
    const currentSaved = localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY)
    if (currentSaved === id || activeId === id) {
      const nextActive = remaining.length > 0 ? remaining[0].id : null
      setActiveIdAndPersist(nextActive)
    }
    if (account) {
      fetch(apiUrl(`/api/chat/conversations/${id}`), { method: 'DELETE', credentials: 'include' }).catch((err) =>
        console.error('Không thể xóa cuộc trò chuyện:', err),
      )
    }
  }, [account, activeId, setActiveIdAndPersist])

  const setSpecialty = useCallback((convId, specialtyId) => {
    const updated = conversationsRef.current.map((c) => (c.id === convId ? { ...c, specialtyId } : c))
    setConversations(updated)
    persistConversation(updated.find((c) => c.id === convId), undefined)
  }, [persistConversation])

  const stopResponding = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(
    async (text, specialtyIdForNew, lang = 'vi', suggestionId = null) => {
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
      const assistantMessage = { id: assistantId, role: 'assistant', content: '', streaming: true, pipelineStage: 'intake' }
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
          if (!smartTitle) return
          setConversations((prev) =>
            prev.map((c) => (c.id === targetConvId ? { ...c, title: smartTitle } : c)),
          )
          const conv = conversationsRef.current.find((c) => c.id === targetConvId)
          persistConversation(conv ? { ...conv, title: smartTitle } : null, lang)
        })
      }

      const controller = new AbortController()
      abortRef.current = controller
      setIsResponding(true)

      const appendToken = (chunk) => {
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + chunk } : m,
                  ),
                }
              : c,
          )
          conversationsRef.current = updated
          return updated
        })
      }

      const updateStatus = (stage) => {
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, pipelineStage: stage } : m,
                  ),
                }
              : c,
          )
          conversationsRef.current = updated
          return updated
        })
      }

      try {
        await streamAssistantReply({
          messages: messagesForApi,
          specialtyId,
          lang,
          isSuggestionDemo: !!suggestionId,
          suggestionId,
          conversationId: specialtyId === DEFAULT_SPECIALTY_ID ? convId : undefined,
          signal: controller.signal,
          onToken: appendToken,
          onStatus: updateStatus,
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
          conversationsRef.current = updated
          // CHỈ LƯU VÀO MONGODB KHI TÀI KHOẢN ĐÃ ĐĂNG NHẬP (ACCOUNT != NULL)
          persistConversation(updated.find((c) => c.id === convId), lang)
          return updated
        })

        setIsResponding(false)
        abortRef.current = null
      }
    },
    [activeId, activeConversation, isResponding, persistConversation, setActiveIdAndPersist],
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
