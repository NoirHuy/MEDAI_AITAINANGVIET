const CACHE_TTL_MS = 30 * 60 * 1000
const stateByConversation = new Map()

function clone(value) {
  return structuredClone(value)
}

function mergeAttributes(previous = {}, incoming = {}) {
  const merged = { ...previous }
  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) {
      if (value.length > 0) merged[key] = value
    } else if (value !== null && value !== undefined) {
      merged[key] = value
    }
  }
  return merged
}

export function mergeSCEState(previous, incoming) {
  if (!previous) return clone(incoming)

  const symptoms = new Map(previous.symptoms.map((symptom) => [symptom.symptomId, clone(symptom)]))
  for (const incomingSymptom of incoming.symptoms) {
    const existing = symptoms.get(incomingSymptom.symptomId)
    if (!existing) {
      symptoms.set(incomingSymptom.symptomId, clone(incomingSymptom))
      continue
    }

    symptoms.set(incomingSymptom.symptomId, {
      ...existing,
      ...incomingSymptom,
      role: existing.role === 'chief_complaint' && incomingSymptom.role !== 'chief_complaint'
        ? 'chief_complaint'
        : incomingSymptom.role || existing.role,
      attributes: mergeAttributes(existing.attributes, incomingSymptom.attributes),
    })
  }

  return {
    demographics: {
      age: incoming.demographics?.age ?? previous.demographics?.age ?? null,
      sex: incoming.demographics?.sex ?? previous.demographics?.sex ?? null,
    },
    temporal: {
      durationValue: incoming.temporal?.durationValue ?? previous.temporal?.durationValue ?? null,
      durationUnit: incoming.temporal?.durationUnit ?? previous.temporal?.durationUnit ?? null,
      onset: incoming.temporal?.onset ?? previous.temporal?.onset ?? null,
    },
    symptoms: [...symptoms.values()],
  }
}

export function getSCEState(conversationId, userMessageCount) {
  if (!conversationId) return null
  const entry = stateByConversation.get(conversationId)
  if (!entry || entry.expiresAt <= Date.now() || entry.userMessageCount !== userMessageCount - 1) {
    if (entry?.expiresAt <= Date.now()) stateByConversation.delete(conversationId)
    return null
  }
  return clone(entry.sce)
}

export function setSCEState(conversationId, userMessageCount, sce) {
  if (!conversationId) return
  stateByConversation.set(conversationId, {
    sce: clone(sce),
    userMessageCount,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export function clearSCEStateCache() {
  stateByConversation.clear()
}
