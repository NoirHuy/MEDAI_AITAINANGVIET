import { SUGGESTIONS } from '../data/suggestions'
import { PulseIcon } from './Icons'
import './WelcomeScreen.css'

export default function WelcomeScreen({ onPick, lang = 'vi' }) {
  const isEn = lang === 'en'
  return (
    <div className="welcome">
      <div className="welcome__badge">
        <PulseIcon className="welcome__badge-icon" />
        <span>MedChat247 AI</span>
      </div>

      <h1 className="welcome__title">
        {isEn ? (
          <>What health questions can <span className="welcome__title-gradient">MedChat247</span> explore for you today?</>
        ) : (
          <>Bạn có thắc mắc sức khỏe nào muốn tìm hiểu cùng <span className="welcome__title-gradient">MedChat247</span> không?</>
        )}
      </h1>

      <p className="welcome__subtitle">
        {isEn 
          ? "Describe symptoms or ask any medical question — or select a prompt below."
          : "Mô tả triệu chứng hoặc đặt bất kỳ câu hỏi y tế nào — hoặc chọn gợi ý bên dưới."
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
