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
      const blockText = lines.join('\n').toLowerCase()
      const isReportBlock = blockText.includes('dẫn chứng') || 
                            blockText.includes('lý giải') || 
                            blockText.includes('dấu hiệu') || 
                            blockText.includes('xác suất') ||
                            blockText.includes('evidence') ||
                            blockText.includes('differential') ||
                            blockText.includes('watch for')

      const isOrdered = lines.length > 1 && lines.every(l => /^\d+\.\s/.test(l.trim()))
      const isBulleted = lines.length > 1 && lines.every(l => /^[-*]\s/.test(l.trim()))

      // Phase 1: Danh sách câu hỏi làm rõ dạng gạch đầu dòng -> Render Thẻ Question Card
      if (isBulleted && !isReportBlock) {
        return (
          <div className="msg-question-cards-list" key={key}>
            {lines.map((line, i) => {
              const content = line.trim().replace(/^[-*]\s/, '')
              return (
                <div className="msg-question-card" key={i}>
                  <span className="msg-question-card__icon">❓</span>
                  <div className="msg-question-card__content">
                    {renderInline(content, `${key}-${i}`)}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      // Phase 1: Danh sách câu hỏi dạng số thứ tự -> Render Thẻ Question Card với số thứ tự
      if (isOrdered && !isReportBlock) {
        return (
          <div className="msg-question-cards-list" key={key}>
            {lines.map((line, i) => {
              const match = line.trim().match(/^(\d+)\.\s*(.*)/)
              const num = match ? match[1] : (i + 1)
              const content = match ? match[2] : line.trim()
              return (
                <div className="msg-question-card" key={i}>
                  <span className="msg-question-card__badge">{num}</span>
                  <div className="msg-question-card__content">
                    {renderInline(content, `${key}-${i}`)}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      // Phase 2: Báo cáo kết luận hoặc Khối hỗn hợp -> Giữ nguyên giao diện đẹp nguyên bản của Phase 2
      return (
        <div key={key} className="msg-mixed-block">
          {lines.map((line, i) => {
            const trimmed = line.trim()
            const cleanLine = trimmed.replace(/\*\*/g, '')

            // 1. Kiểm tra dòng tên bệnh kèm xác suất: "1. Viêm màng não: 60% xác suất"
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

            // 2. Kiểm tra các dòng chi tiết bắt đầu bằng "-"
            if (trimmed.startsWith('-')) {
              const content = trimmed.substring(1).trim()
              const lowerContent = content.toLowerCase()
              const isEvidence = lowerContent.includes('dẫn chứng') || lowerContent.includes('evidence')
              const isReasoning = lowerContent.includes('lý giải') || lowerContent.includes('differential')
              const isWatch = lowerContent.includes('dấu hiệu') || lowerContent.includes('watch for')

              // Chi tiết báo cáo Phase 2 -> Giữ nguyên giao diện nguyên bản Phase 2 với bullet icon chuẩn
              if (isReportBlock || isEvidence || isReasoning || isWatch) {
                let icon = '•'
                if (isEvidence) icon = '📋'
                else if (isReasoning) icon = '🔍'
                else if (isWatch) icon = '⚠️'

                return (
                  <div key={i} className={`disease-detail-line ${isEvidence ? 'disease-detail-line--evidence' : ''}`}>
                    <span className="bullet-dot">{icon}</span>
                    <span className="detail-content">{renderInline(content, `${key}-${i}`)}</span>
                  </div>
                )
              }

              // Câu hỏi Phase 1 đơn lẻ -> Dùng Thẻ Question Card
              return (
                <div key={i} className="msg-question-card">
                  <span className="msg-question-card__icon">❓</span>
                  <div className="msg-question-card__content">
                    {renderInline(content, `${key}-${i}`)}
                  </div>
                </div>
              )
            }

            // 3. Dòng hướng dẫn dẫn dắt câu hỏi (Phase 1)
            if (trimmed.endsWith(':') && (trimmed.toLowerCase().includes('thông tin') || trimmed.toLowerCase().includes('câu hỏi') || trimmed.toLowerCase().includes('hiểu rõ') || trimmed.toLowerCase().includes('chia sẻ'))) {
              return (
                <div key={i} className="msg-intro-guidance">
                  <span className="msg-intro-guidance__icon">🩺</span>
                  <span className="msg-intro-guidance__text">{renderInline(line, `${key}-${i}`)}</span>
                </div>
              )
            }

            // Dòng văn bản bình thường
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

