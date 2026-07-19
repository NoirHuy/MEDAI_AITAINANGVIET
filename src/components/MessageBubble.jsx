import { useState, useCallback } from 'react'
import { PulseIcon } from './Icons'
import TypingDots from './TypingDots'
import './MessageBubble.css'

// ─── SYMPTOM TRANSLATIONS (VI) ────────────────────────────────────────────────
const SYMPTOM_TRANSLATIONS = {
  'fever': 'Sốt', 'chills': 'Ớn lạnh / Rét run', 'fatigue': 'Mệt mỏi',
  'weakness': 'Suy nhược cơ thể', 'weight loss': 'Sút cân', 'weight gain': 'Tăng cân',
  'night sweats': 'Đổ mồ hôi đêm', 'loss of appetite': 'Chán ăn', 'malaise': 'Khó chịu toàn thân',
  'headache': 'Đau đầu', 'dizziness': 'Chóng mặt', 'vertigo': 'Hoa mắt / Chóng mặt quay',
  'confusion': 'Lú lẫn / Mơ hồ', 'seizures': 'Co giật', 'fainting': 'Ngất xỉu',
  'neck stiffness': 'Cứng cổ / Cứng gáy', 'photophobia': 'Sợ ánh sáng',
  'memory loss': 'Mất trí nhớ', 'numbness': 'Tê bì', 'tingling': 'Cảm giác châm chích',
  'ear pain': 'Đau tai', 'hearing loss': 'Giảm thính lực', 'ringing in ears': 'Ù tai',
  'nasal congestion': 'Nghẹt mũi', 'runny nose': 'Chảy nước mũi', 'sore throat': 'Đau họng',
  'hoarseness': 'Khàn giọng', 'difficulty swallowing': 'Khó nuốt',
  'cough': 'Ho', 'dry cough': 'Ho khan', 'productive cough': 'Ho có đờm',
  'shortness of breath': 'Khó thở', 'wheezing': 'Thở khò khè',
  'chest pain': 'Đau ngực', 'chest tightness': 'Tức ngực', 'hemoptysis': 'Ho ra máu',
  'palpitations': 'Hồi hộp / Tim đập nhanh', 'rapid heartbeat': 'Nhịp tim nhanh',
  'swelling': 'Phù nề', 'leg swelling': 'Phù chân',
  'nausea': 'Buồn nôn', 'vomiting': 'Nôn mửa', 'nausea and vomiting': 'Buồn nôn hoặc nôn',
  'abdominal pain': 'Đau bụng', 'stomach pain': 'Đau dạ dày',
  'bloating': 'Đầy hơi / Chướng bụng', 'diarrhea': 'Tiêu chảy', 'constipation': 'Táo bón',
  'bloody stool': 'Đi ngoài ra máu', 'heartburn': 'Ợ nóng / Trào ngược', 'acid reflux': 'Trào ngược axit',
  'frequent urination': 'Tiểu thường xuyên', 'painful urination': 'Tiểu buốt / Tiểu khó',
  'blood in urine': 'Tiểu ra máu', 'urinary retention': 'Bí tiểu',
  'joint pain': 'Đau khớp', 'muscle pain': 'Đau cơ', 'muscle aches': 'Đau mỏi cơ',
  'back pain': 'Đau lưng', 'lower back pain': 'Đau lưng dưới',
  'neck pain': 'Đau cổ', 'stiffness': 'Cứng khớp',
  'skin rash': 'Phát ban ngoài da', 'rash': 'Phát ban', 'itching': 'Ngứa',
  'jaundice': 'Vàng da', 'bruising': 'Bầm tím', 'hives': 'Nổi mề đay',
  'knee lump or mass': 'U / Cục ở đầu gối', 'knee pain': 'Đau đầu gối',
  'pain during pregnancy': 'Đau trong thai kỳ', 'vaginal discharge': 'Khí hư bất thường',
  'irregular periods': 'Rối loạn kinh nguyệt', 'hot flashes': 'Bốc hỏa',
  'swollen lymph nodes': 'Nổi hạch', 'eye pain': 'Đau mắt',
  'blurred vision': 'Mờ mắt', 'red eyes': 'Mắt đỏ',
  'excessive thirst': 'Khát nước nhiều', 'excessive hunger': 'Đói nhiều bất thường',
  'increased urination': 'Đi tiểu nhiều', 'tremor': 'Run tay / Run cơ',
  'difficulty walking': 'Khó đi lại', 'balance problems': 'Mất thăng bằng',
}

// ─── QUESTION TYPE KEYWORDS ───────────────────────────────────────────────────
const SYMPTOM_KW_VI = ['triệu chứng', 'kèm theo', 'có bị', 'nào khác', 'chẳng hạn', 'ví dụ', 'đi kèm', 'xuất hiện', 'cụ thể', 'biểu hiện', 'dấu hiệu']
const SYMPTOM_KW_EN = ['symptom', 'experience', 'accompanied', 'such as', 'any other', 'do you have', 'along with', 'notice', 'signs', 'also feel']

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getSymptomLabel(name, lang) {
  if (lang !== 'vi') return name
  const lower = name.toLowerCase().trim()
  if (SYMPTOM_TRANSLATIONS[lower]) return SYMPTOM_TRANSLATIONS[lower]
  for (const [key, val] of Object.entries(SYMPTOM_TRANSLATIONS)) {
    if (lower.includes(key) || key.includes(lower)) return val
  }
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function detectQuestionType(text, lang) {
  const lower = text.toLowerCase()
  const kws = lang === 'en' ? SYMPTOM_KW_EN : SYMPTOM_KW_VI
  return kws.some(kw => lower.includes(kw)) ? 'symptom' : 'text'
}

function countBulletQuestions(text) {
  if (!text) return 0
  const bullets = text.split('\n').filter(l => /^[-*]\s/.test(l.trim()))
  return bullets.length > 1 ? bullets.length : 0
}

function buildCombinedMessage(inlineAnswers, metadata, lang) {
  const isEn = lang === 'en'
  const parts = []

  Object.values(inlineAnswers).forEach(answer => {
    if (answer.type === 'symptom') {
      const ids = answer.value || []
      const syms = metadata?.symptoms || []
      const confirmed = syms.filter(s => ids.includes(s.id)).map(s => getSymptomLabel(s.name, lang))
      const excluded = syms.filter(s => !ids.includes(s.id)).map(s => getSymptomLabel(s.name, lang))
      if (isEn) {
        if (confirmed.length) parts.push(`Symptoms I have: ${confirmed.join(', ')}`)
        if (excluded.length && confirmed.length) parts.push(`I do not have: ${excluded.join(', ')}`)
        if (!confirmed.length) parts.push('I do not have any of those symptoms')
      } else {
        if (confirmed.length) parts.push(`Triệu chứng tôi có: ${confirmed.join(', ')}`)
        if (excluded.length && confirmed.length) parts.push(`Tôi không bị: ${excluded.join(', ')}`)
        if (!confirmed.length) parts.push('Tôi không có triệu chứng nào trong danh sách đó')
      }
    } else if (answer.type === 'text' && answer.value?.trim()) {
      parts.push(answer.value.trim())
    }
  })

  return parts.join('. ')
}

// ─── INLINE CHIP PICKER (CONTROLLED — no own state) ──────────────────────────
function InlineChipPicker({ symptoms, lang, selectedIds, onChange }) {
  const isEn = lang === 'en'
  const allSelected = selectedIds.length === symptoms.length && symptoms.length > 0

  const toggle = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  return (
    <div className="inline-chip-picker">
      {/* Quick action row */}
      <div className="inline-chip-actions">
        <button
          type="button"
          className="symptom-quick-btn"
          onClick={() => onChange(allSelected ? [] : symptoms.map(s => s.id))}
        >
          {allSelected
            ? (isEn ? 'Deselect all' : 'Bỏ chọn tất cả')
            : (isEn ? 'Select all' : 'Chọn tất cả')}
        </button>
        {selectedIds.length > 0 && (
          <>
            <span className="symptom-count-badge">{selectedIds.length}</span>
            <button
              type="button"
              className="symptom-quick-btn symptom-quick-btn--danger"
              onClick={() => onChange([])}
            >
              {isEn ? 'Clear' : 'Xóa'}
            </button>
          </>
        )}
      </div>

      {/* Chip grid */}
      <div className="inline-chip-grid">
        {symptoms.map(sym => {
          const label = getSymptomLabel(sym.name, lang)
          const isSel = selectedIds.includes(sym.id)
          return (
            <button
              key={sym.id}
              type="button"
              className={`symptom-chip ${isSel ? 'symptom-chip--selected' : ''}`}
              onClick={() => toggle(sym.id)}
              aria-pressed={isSel}
            >
              <span className="symptom-chip__check">
                {isSel ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <polyline points="2,7 5.5,10.5 12,3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* None shortcut */}
      <button
        type="button"
        className={`symptom-none-btn ${selectedIds.length === 0 ? 'symptom-none-btn--none-active' : ''}`}
        onClick={() => onChange([])}
      >
        {isEn ? '✗ None of the above' : '✗ Không có triệu chứng nào'}
      </button>
    </div>
  )
}

// ─── INLINE TEXT INPUT (CONTROLLED — no own state) ───────────────────────────
function InlineTextInput({ lang, value, onChange }) {
  const isEn = lang === 'en'
  return (
    <div className="inline-text-input">
      <input
        type="text"
        className={`inline-text-field ${value?.trim() ? 'inline-text-field--filled' : ''}`}
        placeholder={isEn ? 'Type your answer here...' : 'Nhập câu trả lời của bạn...'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {value?.trim() && (
        <span className="inline-text-indicator" aria-label="answered">✓</span>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MessageBubble({ role, content, streaming, lang = 'vi', isLastAssistant, onSend }) {
  const isUser = role === 'user'
  const isEn = lang === 'en'

  // All inline widget answers keyed by question ID
  const [inlineAnswers, setInlineAnswers] = useState({})
  const [panelDone, setPanelDone] = useState(false)

  // Parse metadata out of content
  let visibleContent = content
  let metadata = null
  const metaIndex = content ? content.indexOf('\n[METADATA]:') : -1
  if (metaIndex !== -1) {
    visibleContent = content.substring(0, metaIndex)
    const metadataStr = content.substring(metaIndex + '\n[METADATA]:'.length)
    if (!streaming && metadataStr.trim()) {
      try { metadata = JSON.parse(metadataStr) } catch (e) { console.error(e) }
    }
  }

  const updateAnswer = useCallback((qKey, type, value) => {
    setInlineAnswers(prev => ({ ...prev, [qKey]: { type, value } }))
  }, [])

  const handleSubmitAll = useCallback(() => {
    const message = buildCombinedMessage(inlineAnswers, metadata, lang)
    if (message.trim()) {
      setPanelDone(true)
      onSend?.(message)
    }
  }, [inlineAnswers, metadata, lang, onSend])

  // Detect question count (only when last assistant, not streaming, not done)
  const questionCount = isLastAssistant && !streaming && !panelDone
    ? countBulletQuestions(visibleContent)
    : 0

  const answeredCount = Object.values(inlineAnswers).filter(a =>
    a.type === 'symptom' ? a.value?.length > 0 : a.value?.trim()
  ).length

  // Context passed to renderer
  const ctx = {
    metadata,
    lang,
    isLastAssistant: isLastAssistant && !panelDone,
    streaming,
    inlineAnswers,
    updateAnswer,
  }

  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--assistant'}`}>
      {!isUser && (
        <div className="message-avatar">
          <PulseIcon />
        </div>
      )}
      <div className="message-col">
        <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}>
          {visibleContent
            ? renderMessageContent(visibleContent, ctx)
            : streaming ? <TypingDots /> : null}
          {streaming && visibleContent && <span className="message-cursor" />}
        </div>

        {!isUser && visibleContent && !streaming && (
          <p className="message-disclaimer">
            {isEn
              ? 'AI may make mistakes. Please consult a doctor if necessary.'
              : 'AI có thể mắc sai sót. Hãy tham khảo bác sĩ khi cần thiết.'}
          </p>
        )}

        {/* ── Unified submit bar ── */}
        {questionCount > 0 && (
          <div className="question-submit-bar">
            <span className="question-submit-progress">
              {answeredCount > 0
                ? `${answeredCount}/${questionCount} ${isEn ? 'answered' : 'đã trả lời'}`
                : (isEn ? 'Fill in the answers above' : 'Điền câu trả lời bên trên')}
            </span>
            <button
              type="button"
              className={`question-submit-btn ${answeredCount === 0 ? 'question-submit-btn--disabled' : ''}`}
              onClick={handleSubmitAll}
              disabled={answeredCount === 0}
            >
              {isEn ? 'Send all answers' : 'Gửi tất cả câu trả lời'}
              {answeredCount > 0 && <span className="question-submit-arrow">→</span>}
            </button>
          </div>
        )}

        {/* ── Done confirmation ── */}
        {panelDone && (
          <div className="questions-done">
            <span className="questions-done__icon">✓</span>
            <span>{isEn ? 'Answers submitted' : 'Đã gửi câu trả lời'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── RENDERER ─────────────────────────────────────────────────────────────────
function renderMessageContent(text, ctx) {
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

    if (/^#{1,4}\s/.test(trimmed)) {
      flushBuffer()
      const level = trimmed.match(/^(#{1,4})\s/)[1].length
      blocks.push({ type: 'heading', level, text: trimmed.replace(/^#{1,4}\s/, '') })
      continue
    }
    if (/^(⚠️|🔴|🚨)/.test(trimmed)) { flushBuffer(); blocks.push({ type: 'alert', variant: 'danger', text: trimmed }); continue }
    if (/^(📋|💡|ℹ️)/.test(trimmed)) { flushBuffer(); blocks.push({ type: 'alert', variant: 'info', text: trimmed }); continue }
    if (/^(✅|🟢)/.test(trimmed)) { flushBuffer(); blocks.push({ type: 'alert', variant: 'success', text: trimmed }); continue }
    if (/^---+$/.test(trimmed)) { flushBuffer(); blocks.push({ type: 'divider' }); continue }
    if (trimmed === '') { flushBuffer(); continue }
    buffer.push(line)
  }
  flushBuffer()

  return blocks.map((block, i) => renderBlock(block, i, ctx))
}

function renderPercentCircle(percent) {
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference
  let color = '#1a73e8'
  if (percent >= 60) color = '#ea4335'
  else if (percent >= 30) color = '#f9ab00'
  else color = '#34a853'

  return (
    <div className="disease-pct-circle-wrapper">
      <svg className="disease-pct-svg" width="36" height="36">
        <circle className="disease-pct-bg" cx="18" cy="18" r={radius} stroke="var(--border-subtle)" strokeWidth="3" fill="transparent" />
        <circle className="disease-pct-fg" cx="18" cy="18" r={radius} stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" fill="transparent" transform="rotate(-90 18 18)" />
        <text x="18" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)">{percent}%</text>
      </svg>
    </div>
  )
}

function renderBlock(block, key, ctx) {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level <= 2 ? 'h2' : block.level === 3 ? 'h3' : 'h4'
      return <Tag key={key} className={`msg-heading msg-heading--${block.level}`}>{renderInline(block.text, `${key}`)}</Tag>
    }
    case 'alert':
      return <div key={key} className={`msg-alert msg-alert--${block.variant}`}>{renderInline(block.text, `${key}`)}</div>
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
        // ── Render with inline widgets for last assistant message ──
        if (ctx.isLastAssistant && !ctx.streaming) {
          const hasSymptoms = ctx.metadata?.symptoms?.length > 0
          return (
            <div key={key} className="question-list">
              {lines.map((line, i) => {
                const content = line.trim().replace(/^[-*]\s/, '')
                const qKey = `q-${key}-${i}`
                const qType = detectQuestionType(content, ctx.lang)
                const answerValue = ctx.inlineAnswers[qKey]?.value

                return (
                  <div key={i} className="question-item">
                    {/* Question text */}
                    <div className="question-bullet">
                      <span className="question-dot">●</span>
                      <span className="question-text">{renderInline(content, `${key}-${i}`)}</span>
                    </div>

                    {/* Inline widget */}
                    {qType === 'symptom' && hasSymptoms ? (
                      <InlineChipPicker
                        symptoms={ctx.metadata.symptoms}
                        lang={ctx.lang}
                        selectedIds={answerValue || []}
                        onChange={(ids) => ctx.updateAnswer(qKey, 'symptom', ids)}
                      />
                    ) : (
                      <InlineTextInput
                        lang={ctx.lang}
                        value={answerValue || ''}
                        onChange={(text) => ctx.updateAnswer(qKey, 'text', text)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        }

        // ── Plain bulleted list (non-last or streaming) ──
        return (
          <ul className="message-list" key={key}>
            {lines.map((line, i) => (
              <li key={i}>{renderInline(line.trim().replace(/^[-*]\s/, ''), `${key}-${i}`)}</li>
            ))}
          </ul>
        )
      }

      // ── Mixed block (disease items with %) ──
      return (
        <div key={key} className="msg-mixed-block">
          {lines.map((line, i) => {
            const trimmed = line.trim()
            const diseaseMatch = trimmed.match(/^(\d+)\.\s*(.*?):\s*~?(\d+)%\s*(xác suất|khả năng|ước tính)?/i)
            if (diseaseMatch) {
              const [, num, name, pctStr] = diseaseMatch
              const percent = parseInt(pctStr, 10)
              return (
                <div key={i} className="disease-item-header">
                  <span className="disease-num">{num}.</span>
                  <span className="disease-name">{name.trim()}</span>
                  {renderPercentCircle(percent)}
                </div>
              )
            }
            if (trimmed.startsWith('-')) {
              const content = trimmed.substring(1).trim()
              const isEvidence = content.toLowerCase().includes('dẫn chứng')
              return (
                <div key={i} className={`disease-detail-line ${isEvidence ? 'disease-detail-line--evidence' : ''}`}>
                  <span className="bullet-dot">{isEvidence ? '📋' : '•'}</span>
                  <span className="detail-content">{renderInline(content, `${key}-${i}`)}</span>
                </div>
              )
            }
            return <p key={i} className="detail-plain-line">{renderInline(line, `${key}-${i}`)}</p>
          })}
        </div>
      )
    }
    default:
      return null
  }
}

// ─── INLINE RENDERER ─────────────────────────────────────────────────────────
function renderInline(text, keyPrefix) {
  return text
    .split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g)
    .filter(part => part.length > 0)
    .map((part, i) => {
      const k = `${keyPrefix}-${i}`
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={k}>{part.slice(2, -2)}</strong>
      if (part.startsWith('_') && part.endsWith('_')) return <em key={k}>{part.slice(1, -1)}</em>
      if (part.startsWith('`') && part.endsWith('`')) return <code key={k} className="msg-code">{part.slice(1, -1)}</code>
      return <span key={k}>{part}</span>
    })
}
