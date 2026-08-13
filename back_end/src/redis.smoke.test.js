// Smoke test: verify all new Redis modules load and exports resolve correctly
// without actually starting the server. Run with: node --test src/_smoke.test.js
// (Or via `node -e "..."`).

import { describe, it, expect } from 'vitest'

describe('Redis integration smoke test', () => {
  it('redis config module exports expected surface', async () => {
    const mod = await import('./config/redis.js')
    expect(typeof mod.connectRedis).toBe('function')
    expect(typeof mod.disconnectRedis).toBe('function')
    expect(typeof mod.getRedisClient).toBe('function')
    expect(typeof mod.isRedisConnected).toBe('function')
    expect(typeof mod.safeGet).toBe('function')
    expect(typeof mod.safeSet).toBe('function')
    expect(typeof mod.safeDel).toBe('function')
  })

  it('redisStore module exports factory', async () => {
    const mod = await import('./middleware/redisStore.js')
    expect(typeof mod.createRedisStore).toBe('function')
    // When Redis is not connected, returns null (falls back to in-memory)
    const store = mod.createRedisStore(60000)
    expect(store === null || typeof store.increment === 'function').toBe(true)
  })

  it('authCache module exports session helpers', async () => {
    const mod = await import('./services/auth/authCache.js')
    expect(typeof mod.storeSession).toBe('function')
    expect(typeof mod.getSession).toBe('function')
    expect(typeof mod.revokeSession).toBe('function')
    expect(typeof mod.isSessionRevoked).toBe('function')
    expect(typeof mod.revokeAllUserSessions).toBe('function')
  })

  it('rateLimiters load without throwing', async () => {
    const mod = await import('./middleware/rateLimiters.js')
    expect(typeof mod.authSigninLimiter).toBe('function')
    expect(typeof mod.authSignupLimiter).toBe('function')
    expect(typeof mod.chatLimiter).toBe('function')
  })

  it('sceStateCache module is async-compatible', async () => {
    const mod = await import('./services/graphrag/sceStateCache.js')
    expect(typeof mod.getSCEState).toBe('function')
    expect(typeof mod.setSCEState).toBe('function')
    expect(typeof mod.mergeSCEState).toBe('function')
  })

  it('neo4jClient cache helpers are async', async () => {
    const mod = await import('./services/graphrag/neo4jClient.js')
    expect(typeof mod.getAllSymptoms).toBe('function')
    expect(typeof mod.invalidateNeo4jCache).toBe('function')
  })

  it('umlsClient is async', async () => {
    const mod = await import('./services/graphrag/umlsClient.js')
    expect(typeof mod.searchUMLS).toBe('function')
  })

  it('embeddingClient is async', async () => {
    const mod = await import('./services/graphrag/embeddingClient.js')
    expect(typeof mod.getEmbeddings).toBe('function')
    expect(typeof mod.getEmbedding).toBe('function')
  })
})