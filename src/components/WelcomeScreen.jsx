import { SUGGESTIONS } from '../data/suggestions'
import { PulseIcon } from './Icons'
import './WelcomeScreen.css'

export default function WelcomeScreen({ onPick }) {
  return (
    <div className="welcome">
      <PulseIcon className="welcome__icon" />
      <h1 className="welcome__title">Chào bạn, tôi có thể giúp gì cho sức khỏe của bạn?</h1>
      <p className="welcome__subtitle">
        Mô tả triệu chứng hoặc đặt câu hỏi về y tế — hoặc thử một gợi ý bên dưới.
      </p>
      <div className="welcome__grid">
        {SUGGESTIONS.map((s) => (
          <button key={s.title} className="suggestion-chip" onClick={() => onPick(s.prompt)}>
            <span className="suggestion-chip__title">{s.title}</span>
            <span className="suggestion-chip__detail">{s.detail}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
