import { describe, expect, it } from 'vitest'
import { getStaticSuggestionReply } from './staticSuggestionReplies.js'

describe('static suggestion replies', () => {
  it('provides a Vietnamese and English reply for each welcome suggestion', () => {
    for (const id of ['disease_1', 'disease_2', 'disease_3', 'disease_4']) {
      expect(getStaticSuggestionReply(id, 'vi')).toContain('##')
      expect(getStaticSuggestionReply(id, 'en')).toContain('##')
    }
  })

  it('does not provide a reply for arbitrary suggestion IDs', () => {
    expect(getStaticSuggestionReply('untrusted-input', 'vi')).toBeNull()
  })
})
