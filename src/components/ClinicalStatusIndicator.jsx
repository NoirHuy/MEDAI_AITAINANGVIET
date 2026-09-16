import { CLINICAL_STAGES, getClinicalStageText } from '../data/clinicalStages'
import './ClinicalStatusIndicator.css'

export default function ClinicalStatusIndicator({ stage = 'intake', lang = 'vi' }) {
  const currentKey = CLINICAL_STAGES[stage] ? stage : 'intake'
  const text = getClinicalStageText(currentKey, lang)

  return (
    <div className="clinical-status-indicator" role="status" aria-live="polite">
      <span className="clinical-status-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span key={currentKey} className="clinical-status-text">
        {text}
      </span>
    </div>
  )
}
