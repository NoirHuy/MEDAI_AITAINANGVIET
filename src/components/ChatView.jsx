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
}) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const hasMessages = messages.length > 0

  return (
    <div className="chat-view">
      <button
        type="button"
        className="chat-view__mobile-menu-btn"
        onClick={onOpenMenu}
        aria-label="Mở menu"
      >
        <MenuIcon />
      </button>

      <div className="chat-disclaimer">
        <AlertIcon />
        <span>
          MedChat cung cấp thông tin tham khảo, không thay thế chẩn đoán hay điều trị của bác sĩ.
        </span>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {hasMessages ? (
          <div className="chat-messages">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} streaming={m.streaming} />
            ))}
          </div>
        ) : (
          <WelcomeScreen onPick={onSend} />
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
      />
    </div>
  )
}
