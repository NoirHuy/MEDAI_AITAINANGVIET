import { useEffect, useRef } from 'react'
import { MenuIcon, AlertIcon } from './Icons'
import WelcomeScreen from './WelcomeScreen'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'
import './ChatView.css'

export default function ChatView({
  messages,
  isResponding,
  inputValue,
  onInputChange,
  onSend,
  onStop,
  specialtyId,
  onSpecialtyChange,
  onOpenMenu,
  lang = 'vi',
  onToggleLang,
}) {
  const scrollRef = useRef(null)
  const isEn = lang === 'en'

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const hasMessages = messages.length > 0

  return (
    <div className="chat-view">
      <div className="chat-view__header-bar">
        <button
          type="button"
          className="chat-view__mobile-menu-btn"
          onClick={onOpenMenu}
          aria-label={isEn ? "Open menu" : "Mở menu"}
        >
          <MenuIcon />
        </button>
        <div className="chat-view__header-title">
          MedAI {isEn ? "Assistant" : "Trợ lý Y khoa"}
        </div>
        <button
          type="button"
          className="lang-toggle-btn"
          onClick={onToggleLang}
          title={isEn ? "Switch to Vietnamese" : "Chuyển sang Tiếng Anh"}
        >
          {isEn ? "English" : "Tiếng Việt"}
        </button>
      </div>

      <div className="chat-disclaimer">
        <AlertIcon />
        <span>
          {isEn
            ? "MedChat provides reference information only, and does not replace professional medical diagnosis or treatment."
            : "MedChat cung cấp thông tin tham khảo, không thay thế chẩn đoán hay điều trị của bác sĩ."
          }
        </span>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {hasMessages ? (
          <div className="chat-messages">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} streaming={m.streaming} lang={lang} />
            ))}
          </div>
        ) : (
          <WelcomeScreen onPick={onSend} lang={lang} />
        )}
      </div>

      <ChatInput
        value={inputValue}
        onChange={onInputChange}
        onSend={() => onSend(inputValue)}
        onStop={onStop}
        isResponding={isResponding}
        specialtyId={specialtyId}
        onSpecialtyChange={onSpecialtyChange}
        lang={lang}
      />
    </div>
  )
}
