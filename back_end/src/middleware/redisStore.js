import { isRedisConnected, safeIncr, safeTTL, getRedisClient } from '../config/redis.js'

/**
 * Redis-backed store for express-rate-limit.
 *
 * When Redis is unavailable, returns null so express-rate-limit falls back to its
 * default in-memory store. This keeps rate limiting working in single-instance
 * dev/test environments while sharing counters across all instances in
 * production where Redis is enabled.
 */
export function createRedisStore(windowMs) {
  if (!isRedisConnected()) return null

  return {
    async increment(key) {
      // Use a sliding window key per windowMs to auto-expire counters
      const fullKey = `rl:${key}`
      const count = await safeIncr(fullKey, Math.ceil(windowMs / 1000))
      if (count === null) {
        // Redis unavailable mid-operation; let the limiter fall back
        return { totalHits: 0, resetTime: new Date(Date.now() + windowMs) }
      }
      const ttl = await safeTTL(fullKey)
      const resetTime = ttl > 0 ? new Date(Date.now() + ttl * 1000) : new Date(Date.now() + windowMs)
      return { totalHits: count, resetTime }
    },

    async decrement(key) {
      const fullKey = `rl:${key}`
      const client = getRedisClient()
      try {
        await client.decr(fullKey)
      } catch {}
    },

    async resetKey(key) {
      const fullKey = `rl:${key}`
      const client = getRedisClient()
      try {
        await client.del(fullKey)
      } catch {}
    },

    async resetAll() {
      // Not commonly used; skip bulk delete to avoid blocking
    },
  }
}