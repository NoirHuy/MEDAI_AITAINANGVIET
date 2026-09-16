import { describe, expect, it } from 'vitest'
import { CLINICAL_STAGES, CLINICAL_STAGE_KEYS, getClinicalStageText } from '../../data/clinicalStages.js'

describe('ClinicalStatusIndicator Stages Configuration', () => {
  it('defines exactly 5 progressive clinical pipeline stages', () => {
    expect(CLINICAL_STAGE_KEYS).toHaveLength(5)
    expect(Object.keys(CLINICAL_STAGES)).toHaveLength(5)
  })

  it('contains the expected pipeline stage keys', () => {
    expect(CLINICAL_STAGE_KEYS).toEqual(['intake', 'extracting', 'graph_query', 'evaluating', 'composing'])
  })

  it('provides bilingual Vietnamese and English copy for each stage', () => {
    for (const key of CLINICAL_STAGE_KEYS) {
      const stage = CLINICAL_STAGES[key]
      expect(typeof stage.vi).toBe('string')
      expect(typeof stage.en).toBe('string')
      expect(stage.vi.trim().length).toBeGreaterThan(0)
      expect(stage.en.trim().length).toBeGreaterThan(0)
    }
  })

  it('does NOT contain emojis or icon glyphs in any stage message', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/u
    for (const key of CLINICAL_STAGE_KEYS) {
      const stage = CLINICAL_STAGES[key]
      expect(stage.vi).not.toMatch(emojiRegex)
      expect(stage.en).not.toMatch(emojiRegex)
    }
  })

  it('uses MedChat247 instead of Bác sĩ AI in stage composing', () => {
    const stageComposing = CLINICAL_STAGES.composing
    expect(stageComposing.vi).toBe('MedChat247 đang soạn thảo tư vấn lâm sàng...')
    expect(stageComposing.vi).not.toContain('Bác sĩ AI')
    expect(stageComposing.en).toBe('MedChat247 is composing clinical consultation response...')
  })

  it('accurately reflects the clinical pipeline stages in Vietnamese', () => {
    expect(CLINICAL_STAGES.intake.vi).toBe('Đang tiếp nhận và phân tích thông tin bệnh nhân...')
    expect(CLINICAL_STAGES.extracting.vi).toBe('Đang bóc tách triệu chứng và yếu tố nguy cơ...')
    expect(CLINICAL_STAGES.graph_query.vi).toBe('Đang đối chiếu đồ thị tri thức y khoa Neo4j & UMLS...')
    expect(CLINICAL_STAGES.evaluating.vi).toBe('Đang đánh giá xác suất bệnh lý và định hướng sàng lọc...')
    expect(CLINICAL_STAGES.composing.vi).toBe('MedChat247 đang soạn thảo tư vấn lâm sàng...')
  })

  it('getClinicalStageText returns appropriate translation and falls back to intake', () => {
    expect(getClinicalStageText('graph_query', 'vi')).toBe('Đang đối chiếu đồ thị tri thức y khoa Neo4j & UMLS...')
    expect(getClinicalStageText('graph_query', 'en')).toBe('Querying Neo4j medical knowledge graph...')
    expect(getClinicalStageText('unknown_stage', 'vi')).toBe('Đang tiếp nhận và phân tích thông tin bệnh nhân...')
  })
})
