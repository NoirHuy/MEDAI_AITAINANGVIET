import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || null,
  openrouterModel: process.env.OPENROUTER_MODEL === 'deepseek/deepseek-v4-flash' 
    ? 'qwen/qwen3.5-flash-02-23' 
    : (process.env.OPENROUTER_MODEL || 'qwen/qwen3.5-flash-02-23'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  // Mark the session cookie Secure once this is actually served over HTTPS.
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  neo4jUri: process.env.NEO4J_URI || 'neo4j+s://01ebae5f.databases.neo4j.io',
  neo4jUsername: process.env.NEO4J_USERNAME || 'neo4j',
  neo4jPassword: process.env.NEO4J_PASSWORD || '',
  neo4jDatabase: process.env.NEO4J_DATABASE || 'neo4j',
  umlsApiKey: process.env.UMLS_API_KEY || null,
  wChiefComplaint: Number(process.env.W_CHIEF_COMPLAINT) || 1.5,
  wAssociated: Number(process.env.W_ASSOCIATED) || 1.0,
  penaltyMultiplier: Number(process.env.PENALTY_MULTIPLIER) || 0.4,
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD) || 0.7,
}
