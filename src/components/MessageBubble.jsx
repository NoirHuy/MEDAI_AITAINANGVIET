import { useState } from 'react'
import { PulseIcon } from './Icons'
import TypingDots from './TypingDots'
import './MessageBubble.css'

const SYMPTOM_TRANSLATIONS = {
  'fever': 'Sốt',
  'nausea and vomiting': 'Buồn nôn hoặc nôn',
  'nausea': 'Buồn nôn',
  'vomiting': 'Nôn mửa',
  'neck stiffness': 'Cứng cổ / Cứng gáy',
  'headache': 'Đau đầu',
  'cough': 'Ho',
  'fatigue': 'Mệt mỏi',
  'sore throat': 'Đau họng',
  'runny nose': 'Chảy nước mũi',
  'shortness of breath': 'Khó thở',
  'chest pain': 'Đau ngực',
  'abdominal pain': 'Đau bụng',
  'diarrhea': 'Tiêu chảy',
  'skin rash': 'Phát ban ngoài da',
  'rash': 'Phát ban',
  'joint pain': 'Đau khớp',
  'muscle pain': 'Đau cơ',
  'muscle aches': 'Đau mỏi cơ',
  'photophobia': 'Sợ ánh sáng',
  'confusion': 'Lú lẫn / mơ hồ',
  'seizures': 'Co giật',
  'ear pain': 'Đau tai',
  'nasal congestion': 'Nghẹt mũi',
  'loss of appetite': 'Chán ăn',
}

function getSymptomLabel(name, lang) {
  if (lang !== 'vi') return name
  const lower = name.toLowerCase().trim()
  if (SYMPTOM_TRANSLATIONS[lower]) return SYMPTOM_TRANSLATIONS[lower]
  for (const [key, val] of Object.entries(SYMPTOM_TRANSLATIONS)) {
    if (lower.includes(key) || key.includes(lower)) return val
  }
  return name
}

export default function MessageBubble({ role, content, streaming, lang = 'vi', isLastAssistant, onSend }) {
  const isUser = role === 'user'
  const isEn = lang === 'en'
  const [checkedSymptomIds, setCheckedSymptomIds] = useState([])

  let visibleContent = content
  let metadata = null
  const metaIndex = content ? content.indexOf('\n[METADATA]:') : -1
  if (metaIndex !== -1) {
    visibleContent = content.substring(0, metaIndex)
    const metadataStr = content.substring(metaIndex + '\n[METADATA]:'.length)
    if (!streaming && metadataStr.trim()) {
      try {
        metadata = JSON.parse(metadataStr)
      } catch (e) {
        console.error(e)
      }
    }
  }

  const toggleSymptom = (id) => {
    setCheckedSymptomIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = () => {
    if (!metadata || !metadata.symptoms) return
    const confirmedNames = []
    const excludedNames = []

    metadata.symptoms.forEach(sym => {
      const label = getSymptomLabel(sym.name, lang)
      if (checkedSymptomIds.includes(sym.id)) {
        confirmedNames.push(label)
      } else {
        excludedNames.push(label)
      }
    })

    let responseText = ''
    if (isEn) {
      if (confirmedNames.length > 0) {
        responseText += `I have the following symptoms: ${confirmedNames.join(', ')}.`
      }
      if (excludedNames.length > 0) {
        responseText += ` I do not have: ${excludedNames.join(', ')}.`
      }
      if (confirmedNames.length === 0 && excludedNames.length === 0) {
        responseText = `I do not have any of the symptoms mentioned above.`
      }
    } else {
      if (confirmedNames.length > 0) {
        responseText += `Tôi có các triệu chứng: ${confirmedNames.join(', ')}.`
      }
      if (excludedNames.length > 0) {
        responseText += ` Tôi không bị: ${excludedNames.join(', ')}.`
      }
      if (confirmedNames.length === 0 && excludedNames.length === 0) {
        responseText = `Tôi không có bất kỳ triệu chứng nào nêu trên.`
      }
    }
    onSend?.(responseText)
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
          {visibleContent ? renderMessageContent(visibleContent) : streaming ? <TypingDots /> : null}
          {streaming && visibleContent && <span className="message-cursor" />}
        </div>
        {!isUser && visibleContent && !streaming && (
          <p className="message-disclaimer">
            {isEn
              ? "AI may make mistakes. Please consult a doctor if necessary."
              : "AI có thể mắc sai sót. Hãy tham khảo bác sĩ khi cần thiết."
            }
          </p>
        )}

        {isLastAssistant && metadata && metadata.symptoms && metadata.symptoms.length > 0 && (
          <div className="symptom-panel">
            <p className="symptom-panel__title">
              {isEn ? "Select symptoms that apply to you:" : "Chọn các triệu chứng bạn gặp phải:"}
            </p>
            <div className="symptom-panel__grid">
              {metadata.symptoms.map(sym => {
                const label = getSymptomLabel(sym.name, lang)
                const isSelected = checkedSymptomIds.includes(sym.id)
                return (
                  <label
                    key={sym.id}
                    className={`symptom-checkbox-row ${isSelected ? 'symptom-checkbox-row--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSymptom(sym.id)}
                    />
                    <span className="symptom-checkbox-label">{label}</span>
                  </label>
                )
              })}
            </div>
            <button className="symptom-submit-btn" onClick={handleSubmit}>
              {isEn ? "Submit Checked Symptoms" : "Xác nhận triệu chứng đã chọn"}
            </button>
          </div>
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
              <li key={i}>{renderInline(line.trim().replace(/^\d+\.\s/, ''), `${key}-${i}`)}</li>
            ))}
          </ol>
        )
      }
      if (isBulleted) {
        return (
          <ul className="message-list" key={key}>
            {lines.map((line, i) => (
              <li key={i}>{renderInline(line.trim().replace(/^[-*]\s/, ''), `${key}-${i}`)}</li>
            ))}
          </ul>
        )
      }

      // Xử lý khối hỗn hợp (Ví dụ: Danh sách bệnh có triệu chứng đi kèm)
      return (
        <div key={key} className="msg-mixed-block">
          {lines.map((line, i) => {
            const trimmed = line.trim()

            // 1. Kiểm tra dòng tên bệnh kèm xác suất:
            // Match các dạng: "1. Tên bệnh: 60% xác suất" hoặc "1. Tên bệnh: ~60% xác suất"
            const diseaseMatch = trimmed.match(/^(\d+)\.\s*(.*?):\s*~?(\d+)%\s*(xác suất|khả năng|ước tính)?/i)
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

