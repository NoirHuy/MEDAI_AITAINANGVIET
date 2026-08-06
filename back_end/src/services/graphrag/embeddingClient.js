import { env } from '../../config/env.js'
import { auditLog } from '../../utils/auditLog.js'

// ─── In-memory embedding cache (key = normalized text, value = Float32Array) ──
const _cache = new Map()

// ─── Cosine similarity between two vectors ────────────────────────────────────
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ─── Batch embed texts via OpenRouter Embeddings API ─────────────────────────
// Returns an array of Float32Array aligned 1:1 with the input texts array.
export async function getEmbeddings(texts) {
  if (!texts || texts.length === 0) return []
  if (!env.openrouterApiKey) {
    auditLog('EMBEDDING', 'Warning', 'OPENROUTER_API not configured — skipping embeddings.', 'warn')
    return texts.map(() => null)
  }

  const results = new Array(texts.length).fill(null)
  const uncachedIdx = []
  const uncachedTexts = []

  // Layer 1: RAM cache hit
  for (let i = 0; i < texts.length; i++) {
    const key = texts[i].toLowerCase().trim()
    if (_cache.has(key)) {
      results[i] = _cache.get(key)
    } else {
      uncachedIdx.push(i)
      uncachedTexts.push(texts[i])
    }
  }

  if (uncachedTexts.length === 0) return results

  // Layer 2: Batch API call to OpenRouter /v1/embeddings
  const BATCH_SIZE = 50
  for (let b = 0; b < uncachedTexts.length; b += BATCH_SIZE) {
    const batch = uncachedTexts.slice(b, b + BATCH_SIZE)
    const batchIdx = uncachedIdx.slice(b, b + BATCH_SIZE)

    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://medchat247.com',
          'X-Title': 'MedChat247 GraphRAG',
        },
        body: JSON.stringify({
          model: env.openrouterEmbeddingModel,
          input: batch,
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenRouter Embedding API ${res.status}: ${errText.slice(0, 200)}`)
      }

      const data = await res.json()
      const embeddings = data.data || []

      for (let i = 0; i < embeddings.length; i++) {
        const vec = new Float32Array(embeddings[i].embedding)
        const key = batch[i].toLowerCase().trim()
        _cache.set(key, vec)
        results[batchIdx[i]] = vec
      }
    } catch (err) {
      auditLog('EMBEDDING', 'Error', `Batch embedding failed: ${err.message}`, 'error')
      // Leave those indices as null — fallback to LLM will handle them
    }
  }

  return results
}

// ─── Single-text convenience wrapper ──────────────────────────────────────────
export async function getEmbedding(text) {
  const [vec] = await getEmbeddings([text])
  return vec ?? null
}
