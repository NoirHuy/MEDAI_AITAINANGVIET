import { useState } from 'react'
import { PulseIcon } from './Icons'
import TypingDots from './TypingDots'
import './MessageBubble.css'

export default function MessageBubble({ role, content, streaming, lang = 'vi', onSend, isLast }) {
  const isUser = role === 'user'
  const isEn = lang === 'en'

  // Kiểm tra và trích xuất danh sách hộp kiểm triệu chứng
  const checklistMatch = !isUser && content ? content.match(/\[SymptomChecklist:\s*(.*?)\]/) : null
  const hasChecklist = !!checklistMatch

  const [checkedIds, setCheckedIds] = useState([])
  const [submitted, setSubmitted] = useState(false)

  let cleanContent = content
  let checklistItems = []

  if (hasChecklist) {
    cleanContent = content.replace(/\[SymptomChecklist:\s*(.*?)\]/g, '').trim()
    checklistItems = checklistMatch[1].split(',').map(item => {
      const parts = item.split('=')
      return {
        id: parts[0]?.trim(),
        name: parts[1]?.trim() || parts[0]?.trim()
      }
    }).filter(item => item.id)
  }

  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--assistant'}`}>
      {!isUser && (
        <div className="message-avatar">
          <PulseIcon />
        </div>
      )}
      <div className="message-col">
        <div
          className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}
        >
          {cleanContent ? renderMessageContent(cleanContent) : streaming ? <TypingDots /> : null}
          {streaming && content && <span className="message-cursor" />}

          {hasChecklist && !streaming && (
            <div className="symptom-checklist-box">
              <p className="symptom-checklist-title">
                {isEn
                  ? "To help differentiate more accurately, please select the symptoms below that you are experiencing so I have enough information to evaluate:"
                  : "Để giúp phân biệt chính xác hơn, bạn vui lòng tích chọn các triệu chứng dưới đây mà bạn đang gặp phải để tôi có đủ thông tin đánh giá:"
                }
              </p>
              <div className="symptom-checklist-grid">
                {checklistItems.map(item => (
                  <label
                    key={item.id}
                    className={`symptom-checkbox-label ${checkedIds.includes(item.id) ? 'symptom-checkbox-label--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="symptom-checkbox-input"
                      disabled={!isLast || submitted}
                      checked={checkedIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCheckedIds([...checkedIds, item.id])
                        } else {
                          setCheckedIds(checkedIds.filter(id => id !== item.id))
                        }
                      }}
                    />
                    <span className="checkbox-custom-label">{item.name}</span>
                  </label>
                ))}
              </div>
              {isLast && !submitted && (
                <button
                  type="button"
                  className="symptom-checklist-submit-btn"
                  onClick={() => {
                    setSubmitted(true)
                    const present = checklistItems.filter(item => checkedIds.includes(item.id)).map(item => item.name)
                    const absent = checklistItems.filter(item => !checkedIds.includes(item.id)).map(item => item.name)
                    
                    let text = ""
                    if (isEn) {
                      text = `I have the following symptoms: ${present.join(', ') || 'none'}. I do not have: ${absent.join(', ') || 'none'}.`
                    } else {
                      text = `Tôi có các triệu chứng: ${present.join(', ') || 'không có'}. Tôi không bị: ${absent.join(', ') || 'không có'}.`
                    }
                    onSend?.(text)
                  }}
                >
                  {isEn ? "Confirm & Send" : "Xác nhận và Gửi"}
                </button>
              )}
            </div>
          )}
        </div>
        {!isUser && content && !streaming && (
          <p className="message-disclaimer">
            {isEn
              ? "AI may make mistakes. Please consult a doctor if necessary."
              : "AI có thể mắc sai sót. Hãy tham khảo bác sĩ khi cần thiết."
            }
          </p>
        )}
      </div>
    </div>
  )
}

// ─── MAIN RENDERER ───────────────────────────────────────────────────────────
function renderMessageContent(text) {
  // Chia text theo dòng và gom thành các block có ngữ nghĩa
  const lines = text.split('\n')
  const blocks = []
  let buffer = []

  const flushBuffer = () => {
    if (buffer.length > 0) {
      blocks.push({ type: 'paragraph', lines: [...buffer] })
      buffer = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Heading: # ## ### ####
    if (/^#{1,4}\s/.test(trimmed)) {
      flushBuffer()
      const level = trimmed.match(/^(#{1,4})\s/)[1].length
      blocks.push({ type: 'heading', level, text: trimmed.replace(/^#{1,4}\s/, '') })
      continue
    }

    // Alert block: lines starting with ⚠️ or 🔴 → warning, 📋 → info, ✅ → success
    if (/^(⚠️|🔴|🚨)/.test(trimmed)) {
      flushBuffer()
      blocks.push({ type: 'alert', variant: 'danger', text: trimmed })
      continue
    }
    if (/^(📋|💡|ℹ️)/.test(trimmed)) {
      flushBuffer()
      blocks.push({ type: 'alert', variant: 'info', text: trimmed })
      continue
    }
    if (/^(✅|🟢)/.test(trimmed)) {
      flushBuffer()
      blocks.push({ type: 'alert', variant: 'success', text: trimmed })
      continue
    }

    // Horizontal rule ---
    if (/^---+$/.test(trimmed)) {
      flushBuffer()
      blocks.push({ type: 'divider' })
      continue
    }

    // Empty line → flush paragraph buffer
    if (trimmed === '') {
      flushBuffer()
      continue
    }

    buffer.push(line)
  }
  flushBuffer()

  return blocks.map((block, i) => renderBlock(block, i))
}

function renderPercentCircle(percent) {
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  // Xác định màu sắc tương ứng với mức độ nguy cơ (%)
  let color = '#1a73e8' // Blue (Thấp)
  if (percent >= 60) {
    color = '#ea4335' // Red (Cao)
  } else if (percent >= 30) {
    color = '#f9ab00' // Yellow/Orange (Trung bình)
  } else {
    color = '#34a853' // Green (Rất thấp / An toàn)
  }

  return (
    <div className="disease-pct-circle-wrapper">
      <svg className="disease-pct-svg" width="36" height="36">
        <circle
          className="disease-pct-bg"
          cx="18"
          cy="18"
          r={radius}
          stroke="var(--border-subtle)"
          strokeWidth="3"
          fill="transparent"
        />
        <circle
          className="disease-pct-fg"
          cx="18"
          cy="18"
          r={radius}
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform="rotate(-90 18 18)"
        />
        <text
          x="18"
          y="22"
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="var(--text-primary)"
        >
          {percent}%
        </text>
      </svg>
    </div>
  )
}

function renderBlock(block, key) {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level <= 2 ? 'h2' : block.level === 3 ? 'h3' : 'h4'
      const cls = `msg-heading msg-heading--${block.level}`
      return <Tag key={key} className={cls}>{renderInline(block.text, `${key}`)}</Tag>
    }

    case 'alert': {
      return (
        <div key={key} className={`msg-alert msg-alert--${block.variant}`}>
          {renderInline(block.text, `${key}`)}
        </div>
      )
    }

    case 'divider':
      return <hr key={key} className="msg-divider" />

    case 'paragraph': {
      const lines = block.lines
      const isOrdered = lines.length > 1 && lines.every(l => /^\d+\.\s/.test(l.trim()))
      const isBulleted = lines.length > 1 && lines.every(l => /^[-*]\s/.test(l.trim()))

      if (isOrdered) {
        return (
          <ol className="message-list" key={key}>
            {lines.map((line, i) => (
              <li key={i}>{renderInlineNoBold(line.trim().replace(/^\d+\.\s/, ''), `${key}-${i}`)}</li>
            ))}
          </ol>
        )
      }
      if (isBulleted) {
        return (
          <ul className="message-list" key={key}>
            {lines.map((line, i) => (
              <li key={i}>{renderInlineNoBold(line.trim().replace(/^[-*]\s/, ''), `${key}-${i}`)}</li>
            ))}
          </ul>
        )
      }

      // Xử lý khối hỗn hợp (Ví dụ: Danh sách bệnh có triệu chứng đi kèm)
      return (
        <div key={key} className="msg-mixed-block">
          {lines.map((line, i) => {
            const trimmed = line.trim()
            const cleanLine = trimmed.replace(/\*\*/g, '')

            // 1. Kiểm tra dòng tên bệnh kèm xác suất:
            // Match các dạng: "1. Tên bệnh: 60% xác suất" hoặc "1. Tên bệnh: ~60% xác suất"
            const diseaseMatch = cleanLine.match(/^(\d+)\.\s*(.*?):\s*~?(\d+)%\s*(xác suất|khả năng|ước tính)?/i)
            if (diseaseMatch) {
              const num = diseaseMatch[1]
              const name = diseaseMatch[2].trim()
              const percent = parseInt(diseaseMatch[3], 10)
              return (
                <div key={i} className="disease-item-header">
                  <span className="disease-num">{num}.</span>
                  <span className="disease-name">{name}</span>
                  {renderPercentCircle(percent)}
                </div>
              )
            }

            // 2. Kiểm tra dòng bắt đầu bằng bullet point "-"
            if (trimmed.startsWith('-')) {
              // Bỏ dấu gạch ngang đầu dòng
              const content = trimmed.substring(1).trim()
              
              // Nếu là dòng "Dẫn chứng từ đồ thị" hoặc "Dẫn chứng"
              const isEvidence = content.toLowerCase().includes('dẫn chứng')
              
              return (
                <div key={i} className={`disease-detail-line ${isEvidence ? 'disease-detail-line--evidence' : ''}`}>
                  <span className="bullet-dot">{isEvidence ? '📋' : '•'}</span>
                  <span className="detail-content">{renderInline(content, `${key}-${i}`)}</span>
                </div>
              )
            }

            // Dòng thường
            return (
              <p key={i} className="detail-plain-line">
                {renderInline(line, `${key}-${i}`)}
              </p>
            )
          })}
        </div>
      )
    }

    default:
      return null
  }
}

// ─── INLINE RENDERER (bold, italic, code) ────────────────────────────────────
function renderInline(text, keyPrefix) {
  return text
    .split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g)
    .filter(part => part.length > 0)
    .map((part, i) => {
      const k = `${keyPrefix}-${i}`
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={k}>{part.slice(2, -2)}</strong>
      if (part.startsWith('_') && part.endsWith('_'))
        return <em key={k}>{part.slice(1, -1)}</em>
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={k} className="msg-code">{part.slice(1, -1)}</code>
      return <span key={k}>{part}</span>
    })
}

// ─── INLINE RENDERER (no bold — dành cho danh sách câu hỏi Phase 1) ──────────
function renderInlineNoBold(text, keyPrefix) {
  // Strip ** trước, rồi render italic/code bình thường
  const stripped = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  return stripped
    .split(/(_[^_]+_|`[^`]+`)/g)
    .filter(part => part.length > 0)
    .map((part, i) => {
      const k = `${keyPrefix}-${i}`
      if (part.startsWith('_') && part.endsWith('_'))
        return <em key={k}>{part.slice(1, -1)}</em>
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={k} className="msg-code">{part.slice(1, -1)}</code>
      return <span key={k}>{part}</span>
    })
}

