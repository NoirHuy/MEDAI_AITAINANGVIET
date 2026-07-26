import { env } from '../../config/env.js'

/**
 * Validates candidate extracted memory items before saving or deduplication.
 * @param {Array} candidateItems 
 * @returns {Array} Array of valid candidate items that passed medical validation and confidence threshold.
 */
export function validateMedicalCandidates(candidateItems = []) {
  const minConfidence = env.memoryMinConfidence || 0.70

  return candidateItems.filter(item => {
    if (!item || !item.content || typeof item.content !== 'string') return false
    
    // Medical status filter: MUST be confirmed medical facts, not hypothetical questions
    const status = (item.medicalStatus || 'confirmed').toLowerCase()
    if (status !== 'confirmed') {
      return false
    }

    // Confidence score filter
    const conf = Number(item.confidence) || 0
    if (conf < minConfidence) {
      return false
    }

    return true
  }).map(item => ({
    ...item,
    confidence: Number(item.confidence) || 0.9,
    subject: ['self', 'family', 'other'].includes(item.subject) ? item.subject : 'self',
    medicalStatus: 'confirmed',
  }))
}
