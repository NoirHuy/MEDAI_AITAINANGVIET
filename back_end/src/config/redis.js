import { createClient } from 'redis'
import { env } from './env.js'
import { auditLog } from '../utils/auditLog.js'

const REDIS_ENABLED = env.redisEnabled

const redisConfig = {
  url: env.redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('[redis] Max reconnection attempts reached. Falling back to in-memory cache.')
        return new Error('Max retries exceeded')
      }
      return Math.min(retries * 100, 3000)
    },
    connectTimeout: 5000,
  },
  password: process.env.REDIS_PASSWORD || undefined,
}

const client = createClient(redisConfig)

let isConnected = false
let connectionPromise = null

// ─── Cache Performance Metrics ─────────────────────────────────────────────
const metrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  connectionAttempts: 0,
  connectionFailures: 0,
  lastHealthCheck: null,
  uptime: 0,
  startTime: Date.now()
}

export function getRedisMetrics() {
  const totalRequests = metrics.hits + metrics.misses
  const hitRate = totalRequests > 0 ? (metrics.hits / totalRequests * 100).toFixed(2) : 0
  return {
    ...metrics,
    totalRequests,
    hitRate: `${hitRate}%`,
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    isConnected
  }
}

export function resetRedisMetrics() {
  metrics.hits = 0
  metrics.misses = 0
  metrics.errors = 0
  metrics.connectionAttempts = 0
  metrics.connectionFailures = 0
  metrics.startTime = Date.now()
}

client.on('error', (err) => {
  if (isConnected) {
    auditLog('REDIS', 'Error', `Redis client error: ${err.message}`, 'error')
  }
})

client.on('connect', () => {
  console.log('[redis] Connected to Redis server.')
  isConnected = true
})

client.on('disconnect', () => {
  console.warn('[redis] Disconnected from Redis server.')
  isConnected = false
})

client.on('reconnecting', () => {
  console.warn('[redis] Reconnecting to Redis server...')
})

export async function connectRedis() {
  if (!REDIS_ENABLED) {
    console.log('[redis] Redis is disabled via REDIS_ENABLED=false. Using in-memory cache only.')
    return false
  }

  if (isConnected) return true
  if (connectionPromise) return connectionPromise

  metrics.connectionAttempts++
  connectionPromise = (async () => {
    try {
      await client.connect()
      await client.ping()
      metrics.lastHealthCheck = new Date().toISOString()
      console.log(`[redis] Ping successful. Connected to ${redisConfig.url}`)
      return true
    } catch (err) {
      metrics.connectionFailures++
      console.warn(`[redis] Failed to connect: ${err.message}. Falling back to in-memory cache.`)
      isConnected = false
      connectionPromise = null
      return false
    }
  })()

  return connectionPromise
}

export async function redisHealthCheck() {
  if (!REDIS_ENABLED) {
    return { healthy: false, reason: 'Redis disabled via config' }
  }
  
  if (!isConnected) {
    return { healthy: false, reason: 'Not connected', metrics: getRedisMetrics() }
  }

  try {
    const start = performance.now()
    await client.ping()
    const latency = Math.round(performance.now() - start)
    metrics.lastHealthCheck = new Date().toISOString()
    
    return {
      healthy: true,
      latency: `${latency}ms`,
      url: redisConfig.url,
      metrics: getRedisMetrics()
    }
  } catch (err) {
    metrics.errors++
    return {
      healthy: false,
      reason: err.message,
      metrics: getRedisMetrics()
    }
  }
}

export async function disconnectRedis() {
  if (!isConnected) return
  try {
    await client.quit()
    isConnected = false
  } catch (err) {
    console.warn(`[redis] Error during disconnect: ${err.message}`)
  }
}

export function getRedisClient() {
  return client
}

export function isRedisConnected() {
  return isConnected
}

export async function safeGet(key) {
  if (!isConnected) {
    metrics.misses++
    return null
  }
  try {
    const value = await client.get(key)
    if (value !== null) {
      metrics.hits++
    } else {
      metrics.misses++
    }
    return value
  } catch (err) {
    metrics.errors++
    auditLog('REDIS', 'Warning', `GET ${key} failed: ${err.message}`, 'warn')
    return null
  }
}

export async function safeSet(key, value, ttlSeconds = null) {
  if (!isConnected) return false
  try {
    if (ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds })
    } else {
      await client.set(key, value)
    }
    return true
  } catch (err) {
    auditLog('REDIS', 'Warning', `SET ${key} failed: ${err.message}`, 'warn')
    return false
  }
}

export async function safeDel(key) {
  if (!isConnected) return false
  try {
    await client.del(key)
    return true
  } catch (err) {
    auditLog('REDIS', 'Warning', `DEL ${key} failed: ${err.message}`, 'warn')
    return false
  }
}

export async function safeDelPattern(pattern) {
  if (!isConnected) return 0
  try {
    const keys = await client.keys(pattern)
    if (keys.length === 0) return 0
    await client.del(keys)
    return keys.length
  } catch (err) {
    auditLog('REDIS', 'Warning', `DEL pattern ${pattern} failed: ${err.message}`, 'warn')
    return 0
  }
}

export async function safeExists(key) {
  if (!isConnected) return false
  try {
    return (await client.exists(key)) > 0
  } catch (err) {
    return false
  }
}

export async function safeIncr(key, ttlSeconds = null) {
  if (!isConnected) return null
  try {
    const val = await client.incr(key)
    if (ttlSeconds && val === 1) {
      await client.expire(key, ttlSeconds)
    }
    return val
  } catch (err) {
    auditLog('REDIS', 'Warning', `INCR ${key} failed: ${err.message}`, 'warn')
    return null
  }
}

export async function safeTTL(key) {
  if (!isConnected) return -2
  try {
    return await client.ttl(key)
  } catch (err) {
    return -2
  }
}