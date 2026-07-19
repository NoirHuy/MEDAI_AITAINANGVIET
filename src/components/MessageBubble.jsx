import { useState } from 'react'
import { PulseIcon } from './Icons'
import TypingDots from './TypingDots'
import './MessageBubble.css'

// ─── SYMPTOM TRANSLATIONS (VI) ────────────────────────────────────────────────
const SYMPTOM_TRANSLATIONS = {
  // General
  'fever': 'Sốt',
  'chills': 'Ớn lạnh / Rét run',
  'fatigue': 'Mệt mỏi',
  'weakness': 'Suy nhược cơ thể',
  'weight loss': 'Sút cân',
  'weight gain': 'Tăng cân',
  'night sweats': 'Đổ mồ hôi đêm',
  'loss of appetite': 'Chán ăn',
  'malaise': 'Khó chịu toàn thân',
  // Head & Neuro
  'headache': 'Đau đầu',
  'dizziness': 'Chóng mặt',
  'vertigo': 'Hoa mắt / Chóng mặt quay',
  'confusion': 'Lú lẫn / Mơ hồ',
  'seizures': 'Co giật',
  'fainting': 'Ngất xỉu',
  'neck stiffness': 'Cứng cổ / Cứng gáy',
  'photophobia': 'Sợ ánh sáng',
  'memory loss': 'Mất trí nhớ',
  'numbness': 'Tê bì',
  'tingling': 'Cảm giác châm chích',
  // ENT
  'ear pain': 'Đau tai',
  'hearing loss': 'Giảm thính lực',
  'ringing in ears': 'Ù tai',
  'nasal congestion': 'Nghẹt mũi',
  'runny nose': 'Chảy nước mũi',
  'sore throat': 'Đau họng',
  'hoarseness': 'Khàn giọng',
  'difficulty swallowing': 'Khó nuốt',
  // Respiratory
  'cough': 'Ho',
  'dry cough': 'Ho khan',
  'productive cough': 'Ho có đờm',
  'shortness of breath': 'Khó thở',
  'wheezing': 'Thở khò khè',
  'chest pain': 'Đau ngực',
  'chest tightness': 'Tức ngực',
  'hemoptysis': 'Ho ra máu',
  // Cardiovascular
  'palpitations': 'Hồi hộp / Tim đập nhanh',
  'rapid heartbeat': 'Nhịp tim nhanh',
  'swelling': 'Phù nề',
  'leg swelling': 'Phù chân',
  // GI
  'nausea': 'Buồn nôn',
  'vomiting': 'Nôn mửa',
  'nausea and vomiting': 'Buồn nôn hoặc nôn',
  'abdominal pain': 'Đau bụng',
  'stomach pain': 'Đau dạ dày',
  'bloating': 'Đầy hơi / Chướng bụng',
  'diarrhea': 'Tiêu chảy',
  'constipation': 'Táo bón',
  'bloody stool': 'Đi ngoài ra máu',
  'heartburn': 'Ợ nóng / Trào ngược',
  'acid reflux': 'Trào ngược axit',
  'loss of bowel control': 'Không kiểm soát đại tiện',
  // Urinary
  'frequent urination': 'Tiểu thường xuyên',
  'painful urination': 'Tiểu buốt / Tiểu khó',
  'blood in urine': 'Tiểu ra máu',
  'urinary retention': 'Bí tiểu',
  // MSK
  'joint pain': 'Đau khớp',
  'muscle pain': 'Đau cơ',
  'muscle aches': 'Đau mỏi cơ',
  'back pain': 'Đau lưng',
  'lower back pain': 'Đau lưng dưới',
  'neck pain': 'Đau cổ',
  'stiffness': 'Cứng khớp',
  // Skin
  'skin rash': 'Phát ban ngoài da',
  'rash': 'Phát ban',
  'itching': 'Ngứa',
  'jaundice': 'Vàng da',
  'bruising': 'Bầm tím',
  'hives': 'Nổi mề đay',
  // Specific
  'knee lump or mass': 'U / Cục ở đầu gối',
  'knee pain': 'Đau đầu gối',
  'pain during pregnancy': 'Đau trong thai kỳ',
  'vaginal discharge': 'Khí hư bất thường',
  'irregular periods': 'Rối loạn kinh nguyệt',
  'hot flashes': 'Bốc hỏa',
  'erectile dysfunction': 'Rối loạn cương dương',
  'swollen lymph nodes': 'Nổi hạch',
  'eye pain': 'Đau mắt',
  'blurred vision': 'Mờ mắt',
  'red eyes': 'Mắt đỏ',
  'excessive thirst': 'Khát nước nhiều',
  'excessive hunger': 'Đói nhiều bất thường',
  'increased urination': 'Đi tiểu nhiều',
  'tremor': 'Run tay / Run cơ',
  'difficulty walking': 'Khó đi lại',
  'balance problems': 'Mất thăng bằng',
}

function getSymptomLabel(name, lang) {
  if (lang !== 'vi') return name
  const lower = name.toLowerCase().trim()
  if (SYMPTOM_TRANSLATIONS[lower]) return SYMPTOM_TRANSLATIONS[lower]
  for (const [key, val] of Object.entries(SYMPTOM_TRANSLATIONS)) {
    if (lower.includes(key) || key.includes(lower)) return val
  }
  // Fallback: capitalize and return as-is if no translation found
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ─── SYMPTOM PANEL COMPONENT ─────────────────────────────────────────────────
function SymptomPanel({ symptoms, lang, onSend }) {
  const isEn = lang === 'en'
  const [checkedIds, setCheckedIds] = useState([])
  const [submitted, setSubmitted] = useState(false)

  const toggleSymptom = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAll = () => setCheckedIds(symptoms.map(s => s.id))
  const clearAll = () => setCheckedIds([])

  const handleSubmit = () => {
    const confirmedNames = []
    const excludedNames = []

    symptoms.forEach(sym => {
      const label = getSymptomLabel(sym.name, lang)
      if (checkedIds.includes(sym.id)) {
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
        responseText = 'I do not have any of the symptoms mentioned above.'
      }
    } else {
      if (confirmedNames.length > 0) {
        responseText += `Tôi có các triệu chứng: ${confirmedNames.join(', ')}.`
      }
      if (excludedNames.length > 0) {
        responseText += ` Tôi không bị: ${excludedNames.join(', ')}.`
      }
      if (confirmedNames.length === 0 && excludedNames.length === 0) {
        responseText = 'Tôi không có bất kỳ triệu chứng nào nêu trên.'
      }
    }
    setSubmitted(true)
    onSend?.(responseText)
  }

  const handleNone = () => {
    const text = isEn
      ? 'I do not have any of the symptoms mentioned above.'
      : 'Tôi không có bất kỳ triệu chứng nào nêu trên.'
    setSubmitted(true)
    onSend?.(text)
  }

  if (submitted) {
    return (
      <div className="symptom-panel symptom-panel--submitted">
        <p className="symptom-panel__done">
          {isEn ? '✓ Response submitted' : '✓ Đã gửi phản hồi'}
        </p>
      </div>
    )
  }

  const selectedCount = checkedIds.length
  const allSelected = selectedCount === symptoms.length

  return (
    <div className="symptom-panel">
      {/* Header */}
      <div className="symptom-panel__header">
        <div className="symptom-panel__title-row">
          <span className="symptom-panel__icon">🩺</span>
          <p className="symptom-panel__title">
            {isEn ? 'Select symptoms you are experiencing:' : 'Chọn triệu chứng bạn đang gặp phải:'}
          </p>
        </div>
        {selectedCount > 0 && (
          <span className="symptom-count-badge">
            {selectedCount}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="symptom-quick-actions">
        <button
          type="button"
          className="symptom-quick-btn"
          onClick={allSelected ? clearAll : selectAll}
        >
          {allSelected
            ? (isEn ? 'Deselect all' : 'Bỏ chọn tất cả')
            : (isEn ? 'Select all' : 'Chọn tất cả')}
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            className="symptom-quick-btn symptom-quick-btn--danger"
            onClick={clearAll}
          >
            {isEn ? 'Clear' : 'Xóa lựa chọn'}
          </button>
        )}
      </div>

      {/* Chip Grid */}
      <div className="symptom-chip-grid">
        {symptoms.map(sym => {
          const label = getSymptomLabel(sym.name, lang)
          const isSelected = checkedIds.includes(sym.id)
          return (
            <button
              key={sym.id}
              type="button"
              className={`symptom-chip ${isSelected ? 'symptom-chip--selected' : ''}`}
              onClick={() => toggleSymptom(sym.id)}
              aria-pressed={isSelected}
            >
              <span className="symptom-chip__check">
                {isSelected ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <polyline points="2,7 5.5,10.5 12,3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="symptom-chip__circle" />
                )}
              </span>
              <span className="symptom-chip__label">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="symptom-panel__footer">
        <button
          type="button"
          className="symptom-none-btn"
          onClick={handleNone}
        >
          {isEn ? '✗ None of the above' : '✗ Không có triệu chứng nào'}
        </button>
        <button
          type="button"
          className={`symptom-submit-btn ${selectedCount === 0 ? 'symptom-submit-btn--disabled' : ''}`}
          onClick={handleSubmit}
          disabled={selectedCount === 0}
        >
          {selectedCount > 0
            ? (isEn ? `Confirm ${selectedCount} symptom${selectedCount > 1 ? 's' : ''}` : `Xác nhận ${selectedCount} triệu chứng`)
            : (isEn ? 'Select at least one' : 'Vui lòng chọn triệu chứng')
          }
        </button>
      </div>
    </div>
  )
}

// ─── MAIN MESSAGE BUBBLE ──────────────────────────────────────────────────────
export default function MessageBubble({ role, content, streaming, lang = 'vi', isLastAssistant, onSend }) {
  const isUser = role === 'user'
  const isEn = lang === 'en'

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
          <SymptomPanel
            symptoms={metadata.symptoms}
            lang={lang}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  )
}

// ─── MAIN RENDERER ────────────────────────────────────────────────────────────
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
