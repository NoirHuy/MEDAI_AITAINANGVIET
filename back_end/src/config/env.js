import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').trim(),
  jwtSecret: (process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me').trim(),
  ninerouterApi: (process.env.NINEROUTER_API || '').trim(),
  ninerouterUrl: (process.env.NINEROUTER_URL || 'http://ninerouter:20128/v1').trim(),
  get llmApiKey() {
    return this.ninerouterApi
  },
  get llmBaseUrl() {
    let url = this.ninerouterUrl
    // Translate 'http://ninerouter' container host to 'http://127.0.0.1' when running on local machine
    if (url.includes('http://ninerouter') && process.platform === 'win32') {
      url = url.replace('http://ninerouter', 'http://127.0.0.1')
    }
    return url
  },
  openrouterModel: (process.env.OPENROUTER_MODEL || 'gemini/gemini-3.1-flash-lite-preview').trim(),
  openrouterModelNer: (process.env.OPENROUTER_MODEL_NER || 'gemini/gemini-3.1-flash-lite-preview').trim(),
  openrouterModelChat: (process.env.OPENROUTER_MODEL_CHAT || 'gemini/gemini-3.1-flash-lite-preview').trim(),
  // Direct OpenRouter API (for embeddings — separate from 9Router proxy)
  openrouterApiKey: (process.env.OPENROUTER_API || '').trim(),
  openrouterEmbeddingModel: (process.env.OPENROUTER_EMBEDDING_MODEL || 'perplexity/pplx-embed-v1-4b').trim(),
  embeddingSimilarityThreshold: Number(process.env.EMBEDDING_SIMILARITY_THRESHOLD) || 0.35,
  googleClientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : null,
  // Mark the session cookie Secure once this is actually served over HTTPS.
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  get neo4jUri() {
    let uri = (process.env.NEO4J_URI || 'bolt://103.56.160.46:7687').trim()
    if (uri.includes('bolt://neo4j') && process.platform === 'win32') {
      uri = uri.replace('bolt://neo4j', 'bolt://127.0.0.1')
    }
    return uri
  },
  neo4jUsername: (process.env.NEO4J_USERNAME || 'neo4j').trim(),
  neo4jPassword: (process.env.NEO4J_PASSWORD || 'MatKhauNeo4j2026!').trim(),
  neo4jDatabase: (process.env.NEO4J_DATABASE || 'neo4j').trim(),
  mongodbUri: (process.env.MONGODB_URI || 'mongodb://localhost:27018/medchat').trim(),
  umlsApiKey: process.env.UMLS_API_KEY ? process.env.UMLS_API_KEY.trim() : null,
  paypalClientId: (process.env.PAYPAL_CLIENT_ID || '').trim(),
  paypalClientSecret: (process.env.PAYPAL_CLIENT_SECRET || '').trim(),
  paypalMode: (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase(),
  get paypalApiBase() {
    return this.paypalMode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'
  },
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@medchat.ai').trim(),
  wChiefComplaint: Number(process.env.W_CHIEF_COMPLAINT) || 1.5,
  wAssociated: Number(process.env.W_ASSOCIATED) || 1.0,
  penaltyMultiplier: Number(process.env.PENALTY_MULTIPLIER) || 0.8,
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD) || 0.7,
  memoryEncryptionKey: (process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_medai_memory_secret_key_32bytes').trim(),
  memoryMaxPerUser: Number(process.env.MEMORY_MAX_PER_USER) || 500,
  memoryMinConfidence: Number(process.env.MEMORY_MIN_CONFIDENCE) || 0.70,
  memoryTokenBudget: Number(process.env.MEMORY_TOKEN_BUDGET) || 500,
}
