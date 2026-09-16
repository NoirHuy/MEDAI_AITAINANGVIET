import { describe, expect, it } from 'vitest'
import { CLINICAL_STAGES } from '../../data/clinicalStages.js'

describe('ClinicalStatusIndicator Stages Configuration', () => {
  it('defines exactly 5 progressive clinical pipeline stages', () => {
    expect(CLINICAL_STAGES).toHaveLength(5)
  })

  it('has proper timing delays reflecting the multi-stage pipeline', () => {
    const delays = CLINICAL_STAGES.map((s) => s.delay)
    expect(delays).toEqual([0, 2000, 4500, 6500, 8500])
  })

  it('provides bilingual Vietnamese and English copy for each stage', () => {
    for (const stage of CLINICAL_STAGES) {
      expect(typeof stage.vi).toBe('string')
      expect(typeof stage.en).toBe('string')
      expect(stage.vi.trim().length).toBeGreaterThan(0)
      expect(stage.en.trim().length).toBeGreaterThan(0)
    }
  })

  it('does NOT contain emojis or icon glyphs in any stage message', () => {
    // Emoji & symbol unicode ranges: 1F300-1FAFF, 2600-27BF, 2300-23FF
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/u
    for (const stage of CLINICAL_STAGES) {
      expect(stage.vi).not.toMatch(emojiRegex)
      expect(stage.en).not.toMatch(emojiRegex)
    }
  })

  it('uses MedChat247 instead of Bác sĩ AI in stage 5', () => {
    const stage5 = CLINICAL_STAGES[4]
    expect(stage5.vi).toBe('MedChat247 đang soạn thảo tư vấn lâm sàng...')
    expect(stage5.vi).not.toContain('Bác sĩ AI')
    expect(stage5.en).toBe('MedChat247 is composing clinical consultation response...')
  })

  it('accurately reflects the clinical pipeline stages in Vietnamese', () => {
    expect(CLINICAL_STAGES[0].vi).toBe('Đang tiếp nhận và phân tích thông tin bệnh nhân...')
    expect(CLINICAL_STAGES[1].vi).toBe('Đang bóc tách triệu chứng và yếu tố nguy cơ...')
    expect(CLINICAL_STAGES[2].vi).toBe('Đang đối chiếu đồ thị tri thức y khoa Neo4j & UMLS...')
    expect(CLINICAL_STAGES[3].vi).toBe('Đang đánh giá xác suất bệnh lý và định hướng sàng lọc...')
    expect(CLINICAL_STAGES[4].vi).toBe('MedChat247 đang soạn thảo tư vấn lâm sàng...')
  })
})
