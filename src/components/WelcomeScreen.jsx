import { SUGGESTIONS } from '../data/suggestions'
import { PulseIcon } from './Icons'
import './WelcomeScreen.css'

export default function WelcomeScreen({ onPick, lang = 'vi' }) {
  const isEn = lang === 'en'
  return (
    <div className="welcome">
      <PulseIcon className="welcome__icon" />
      <h1 className="welcome__title">
        {isEn ? "Hello, how can I help with your health today?" : "Chào bạn, tôi có thể giúp gì cho sức khỏe của bạn?"}
      </h1>
      <p className="welcome__subtitle">
        {isEn 
          ? "Describe your symptoms or ask a medical question — or try a suggestion below."
          : "Mô tả triệu chứng hoặc đặt câu hỏi về y tế — hoặc thử một gợi ý bên dưới."
        }
      </p>
      <div className="welcome__grid">
        {SUGGESTIONS.map((s) => {
          const title = typeof s.title === 'object' ? (s.title[lang] || s.title.vi) : s.title
          const detail = typeof s.detail === 'object' ? (s.detail[lang] || s.detail.vi) : s.detail
          const prompt = typeof s.prompt === 'object' ? (s.prompt[lang] || s.prompt.vi) : s.prompt
          return (
            <button key={title} className="suggestion-chip" onClick={() => onPick(prompt, s.isDemo)}>
              <span className="suggestion-chip__title">{title}</span>
              <span className="suggestion-chip__detail">{detail}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
