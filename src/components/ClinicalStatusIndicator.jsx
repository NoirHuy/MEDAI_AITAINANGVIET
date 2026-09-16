import { useState, useEffect } from 'react'
import { CLINICAL_STAGES } from '../data/clinicalStages'
import './ClinicalStatusIndicator.css'

export default function ClinicalStatusIndicator({ lang = 'vi' }) {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const timers = []
    for (let i = 1; i < CLINICAL_STAGES.length; i++) {
      const timer = setTimeout(() => {
        setStageIndex(i)
      }, CLINICAL_STAGES[i].delay)
      timers.push(timer)
    }

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  const currentStage = CLINICAL_STAGES[stageIndex] || CLINICAL_STAGES[0]
  const text = lang === 'en' ? currentStage.en : currentStage.vi

  return (
    <div className="clinical-status-indicator" role="status" aria-live="polite">
      <span className="clinical-status-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span key={stageIndex} className="clinical-status-text">
        {text}
      </span>
    </div>
  )
}
