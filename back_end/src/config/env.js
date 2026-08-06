import 'dotenv/config'
import crypto from 'node:crypto'

// Generates a cryptographically random placeholder string for use in
// env.defaults. We use a fixed-looking hex prefix so security scanners
// can easily flag it, but it is still unique per startup.
const _random = crypto.randomBytes(8).toString('hex')
const PLACEHOLDER_SECRET = `PLACEHOLDER-${_random}`

const isProd = process.env.NODE_ENV === 'production'

function requireInProd(value, key) {
  if (isProd && (!value || value.startsWith('PLACEHOLDER'))) {
    throw new Error(`[env] Missing required env var in production: ${key}`)
  }
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').trim(),

  get jwtSecret() {
    const val = (process.env.JWT_SECRET || PLACEHOLDER_SECRET).trim()
    if (isProd && val === PLACEHOLDER_SECRET) {
      throw new Error('[env] JWT_SECRET must be set in production.')
    }
    if (!isProd && val === PLACEHOLDER_SECRET) {
      console.warn('[env] WARNING: Using insecure JWT_SECRET placeholder. Set JWT_SECRET in .env for any non-dev deployment.')
    }
    return val
  },

  ninerouterApi: (process.env.NINEROUTER_API || '').trim(),
  ninerouterUrl: (process.env.NINEROUTER_URL || 'http://ninerouter:20128/v1').trim(),
  get llmApiKey() { return this.ninerouterApi },
  get llmBaseUrl() {
    let url = this.ninerouterUrl
    if (url.includes('http://ninerouter') && process.platform === 'win32') {
      url = url.replace('http://ninerouter', 'http://127.0.0.1')
    }
    return url
  },

  openrouterModel: (process.env.OPENROUTER_MODEL || 'gemini/gemini-3.1-flash-lite-preview').trim(),
  openrouterModelNer: (process.env.OPENROUTER_MODEL_NER || 'gemini/gemini-3.1-flash-lite-preview').trim(),
  openrouterModelChat: (process.env.OPENROUTER_MODEL_CHAT || 'gemini/gemini-3.1-flash-lite-preview').trim(),
  openrouterApiKey: (process.env.OPENROUTER_API || '').trim(),
  openrouterEmbeddingModel: (process.env.OPENROUTER_EMBEDDING_MODEL || 'perplexity/pplx-embed-v1-4b').trim(),
  embeddingSimilarityThreshold: Number(process.env.EMBEDDING_SIMILARITY_THRESHOLD) || 0.35,

  googleClientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : null,
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  get neo4jUri() {
    let uri = (process.env.NEO4J_URI || '').trim()
    if (!uri) uri = 'bolt://127.0.0.1:7687'
    if (uri.includes('bolt://neo4j') && process.platform === 'win32') {
      uri = uri.replace('bolt://neo4j', 'bolt://127.0.0.1')
    }
    requireInProd(uri.startsWith('PLACEHOLDER') ? '' : uri, 'NEO4J_URI')
    return uri
  },
  get neo4jUsername() {
    const val = (process.env.NEO4J_USERNAME || PLACEHOLDER_SECRET).trim()
    requireInProd(val, 'NEO4J_USERNAME')
    return val
  },
  get neo4jPassword() {
    const val = (process.env.NEO4J_PASSWORD || PLACEHOLDER_SECRET).trim()
    if (isProd && val === PLACEHOLDER_SECRET) {
      throw new Error('[env] NEO4J_PASSWORD must be set in production.')
    }
    if (!isProd && val === PLACEHOLDER_SECRET) {
      console.warn('[env] WARNING: Using insecure Neo4j password placeholder. Set NEO4J_PASSWORD in .env for any non-dev deployment.')
    }
    return val
  },
  neo4jDatabase: (process.env.NEO4J_DATABASE || 'neo4j').trim(),

  get mongodbUri() {
    const val = (process.env.MONGODB_URI || PLACEHOLDER_SECRET).trim()
    if (isProd && val === PLACEHOLDER_SECRET) {
      throw new Error('[env] MONGODB_URI must be set in production.')
    }
    return val
  },

  umlsApiKey: process.env.UMLS_API_KEY ? process.env.UMLS_API_KEY.trim() : null,

  get paypalClientId() {
    const val = (process.env.PAYPAL_CLIENT_ID || '').trim()
    requireInProd(val, 'PAYPAL_CLIENT_ID')
    return val
  },
  get paypalClientSecret() {
    const val = (process.env.PAYPAL_CLIENT_SECRET || '').trim()
    requireInProd(val, 'PAYPAL_CLIENT_SECRET')
    return val
  },
  paypalMode: (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase(),
  get paypalApiBase() {
    return this.paypalMode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'
  },
  get paypalWebhookId() {
    const val = (process.env.PAYPAL_WEBHOOK_ID || '').trim()
    return val
  },

  adminEmail: (process.env.ADMIN_EMAIL || 'admin@medchat247.ai').trim(),

  wChiefComplaint: Number(process.env.W_CHIEF_COMPLAINT) || 1.5,
  wAssociated: Number(process.env.W_ASSOCIATED) || 1.0,
  penaltyMultiplier: Number(process.env.PENALTY_MULTIPLIER) || 0.8,
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD) || 0.7,

  get memoryEncryptionKey() {
    const val = (process.env.MEMORY_ENCRYPTION_KEY || PLACEHOLDER_SECRET).trim()
    if (isProd && val === PLACEHOLDER_SECRET) {
      throw new Error('[env] MEMORY_ENCRYPTION_KEY must be set in production.')
    }
    if (!isProd && val === PLACEHOLDER_SECRET) {
      console.warn('[env] WARNING: Using insecure memory encryption key placeholder. Set MEMORY_ENCRYPTION_KEY in .env for any non-dev deployment.')
    }
    return val
  },

  memoryMaxPerUser: Number(process.env.MEMORY_MAX_PER_USER) || 500,
  memoryMinConfidence: Number(process.env.MEMORY_MIN_CONFIDENCE) || 0.70,
  memoryTokenBudget: Number(process.env.MEMORY_TOKEN_BUDGET) || 500,

  // Expose NODE_ENV for guards elsewhere without importing process
  isProd,
}
