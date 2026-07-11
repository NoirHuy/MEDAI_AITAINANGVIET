import { useEffect, useRef } from 'react'
import { PaperclipIcon, MicIcon, SendIcon, StopIcon } from './Icons'
import SpecialtyPicker from './SpecialtyPicker'
import { SPECIALTIES } from '../data/specialties'
import './ChatInput.css'

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isResponding,
  specialtyId,
  onSpecialtyChange,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isResponding && value.trim()) onSend()
    }
  }

  return (
    <div className="chat-input">
      <div className="chat-input__box">
        <button
          type="button"
          className="chat-input__icon-btn"
          title="Đính kèm tệp (sắp ra mắt)"
          disabled
        >
          <PaperclipIcon />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Mô tả triệu chứng hoặc đặt câu hỏi về sức khỏe..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <SpecialtyPicker
          specialties={SPECIALTIES}
          value={specialtyId}
          onChange={onSpecialtyChange}
          direction="up"
          align="end"
          variant="pill"
        />
        <button
          type="button"
          className="chat-input__icon-btn"
          title="Nhập bằng giọng nói (sắp ra mắt)"
          disabled
        >
          <MicIcon />
        </button>
        {isResponding ? (
          <button
            type="button"
            className="chat-input__send chat-input__send--stop"
            onClick={onStop}
            title="Dừng phản hồi"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            className="chat-input__send"
            onClick={onSend}
            disabled={!value.trim()}
            title="Gửi"
          >
            <SendIcon />
          </button>
        )}
      </div>
      <p className="chat-input__hint">
        MedChat có thể đưa ra thông tin chưa chính xác. Đây không phải lời khuyên y tế chính thức —
        hãy tham khảo bác sĩ khi cần.
      </p>
    </div>
  )
}
