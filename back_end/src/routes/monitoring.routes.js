import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getRedisMetrics, redisHealthCheck } from '../config/redis.js'
import { SystemLogModel } from '../db/systemLog.model.js'

const router = Router()

// Health check endpoint with detailed status
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const redisHealth = await redisHealthCheck()
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: redisHealth,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      }
    })
  })
)

// Performance metrics endpoint
router.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    const { timeRange = '1h' } = req.query
    
    // Calculate time window
    const timeWindows = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    }
    const windowMs = timeWindows[timeRange] || timeWindows['1h']
    const since = new Date(Date.now() - windowMs)
    
    // Fetch performance logs
    const perfLogs = await SystemLogModel.find({
      type: 'perf',
      createdAt: { $gte: since }
    }).lean().limit(1000)
    
    // Calculate statistics
    const durations = perfLogs.map(log => log.meta?.durationMs).filter(Boolean)
    const tokenCounts = perfLogs.map(log => log.meta?.totalTokens).filter(Boolean)
    
    const percentile = (arr, p) => {
      if (arr.length === 0) return 0
      const sorted = [...arr].sort((a, b) => a - b)
      const index = Math.ceil((p / 100) * sorted.length) - 1
      return sorted[index]
    }
    
    // Stage-specific metrics
    const stageMetrics = {}
    const stages = ['memoryRetrievalMs', 'loadSymptomCatalogMs', 'symptomExtractionMs', 'graphRankingMs', 'answerGenerationMs']
    
    for (const stage of stages) {
      const values = perfLogs.map(log => log.meta?.[stage]).filter(Boolean)
      if (values.length > 0) {
        stageMetrics[stage] = {
          count: values.length,
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          p50: percentile(values, 50),
          p95: percentile(values, 95),
          p99: percentile(values, 99),
          max: Math.max(...values)
        }
      }
    }
    
    res.json({
      timeRange,
      totalRequests: perfLogs.length,
      responseTime: {
        avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) || 0,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99),
        max: Math.max(...durations, 0)
      },
      tokens: {
        avg: Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length) || 0,
        total: tokenCounts.reduce((a, b) => a + b, 0)
      },
      stageMetrics,
      redis: getRedisMetrics(),
      generatedAt: new Date().toISOString()
    })
  })
)

// Error rate metrics
router.get(
  '/errors',
  asyncHandler(async (req, res) => {
    const { timeRange = '1h' } = req.query
    
    const timeWindows = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    }
    const windowMs = timeWindows[timeRange] || timeWindows['1h']
    const since = new Date(Date.now() - windowMs)
    
    const errorLogs = await SystemLogModel.find({
      type: 'error',
      createdAt: { $gte: since }
    }).lean().limit(500)
    
    // Group by error type
    const errorsByType = {}
    for (const log of errorLogs) {
      const errType = log.meta?.error || 'Unknown'
      errorsByType[errType] = (errorsByType[errType] || 0) + 1
    }
    
    res.json({
      timeRange,
      totalErrors: errorLogs.length,
      errorsByType,
      recentErrors: errorLogs.slice(0, 10).map(log => ({
        message: log.message,
        error: log.meta?.error,
        timestamp: log.createdAt
      })),
      generatedAt: new Date().toISOString()
    })
  })
)

export default router
