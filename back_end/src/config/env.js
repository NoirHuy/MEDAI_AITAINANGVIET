import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').trim(),
  jwtSecret: (process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me').trim(),
  openrouterApiKey: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.trim() : null,
  openrouterBaseUrl: (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').trim(),
  ninerouterApi: process.env.NINEROUTER_API ? process.env.NINEROUTER_API.trim() : null,
  ninerouterUrl: process.env.NINEROUTER_URL ? process.env.NINEROUTER_URL.trim() : null,
  get llmApiKey() {
    return this.ninerouterApi || this.openrouterApiKey
  },
  get llmBaseUrl() {
    return this.ninerouterUrl || this.openrouterBaseUrl
  },
  openrouterModel: (process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash').trim(),
  openrouterModelNer: (process.env.OPENROUTER_MODEL_NER || 'google/gemini-2.5-flash-lite').trim(),
  openrouterModelChat: (process.env.OPENROUTER_MODEL_CHAT || 'google/gemini-3-flash-preview').trim(),
  googleClientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : null,
  // Mark the session cookie Secure once this is actually served over HTTPS.
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  neo4jUri: (process.env.NEO4J_URI || 'neo4j+s://01ebae5f.databases.neo4j.io').trim(),
  neo4jUsername: (process.env.NEO4J_USERNAME || 'neo4j').trim(),
  neo4jPassword: (process.env.NEO4J_PASSWORD || '').trim(),
  neo4jDatabase: (process.env.NEO4J_DATABASE || 'neo4j').trim(),
  mongodbUri: (process.env.MONGODB_URI || 'mongodb://localhost:27018/medchat').trim(),
  umlsApiKey: process.env.UMLS_API_KEY ? process.env.UMLS_API_KEY.trim() : null,
  stripeSecretKey: (process.env.STRIPE_SECRET_KEY || '').trim(),
  stripePublishableKey: (process.env.STRIPE_PUBLISHABLE_KEY || '').trim(),
  payosClientId: (process.env.PAYOS_CLIENT_ID || '').trim(),
  payosApiKey: (process.env.PAYOS_API_KEY || '').trim(),
  payosChecksumKey: (process.env.PAYOS_CHECKSUM_KEY || '').trim(),
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@medchat.ai').trim(),
  wChiefComplaint: Number(process.env.W_CHIEF_COMPLAINT) || 1.5,
  wAssociated: Number(process.env.W_ASSOCIATED) || 1.0,
  penaltyMultiplier: Number(process.env.PENALTY_MULTIPLIER) || 0.8,
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD) || 0.7,
}
