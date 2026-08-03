import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { connectDatabase } from './db/mongodb.js'
import authRoutes from './routes/auth.routes.js'
import accountRoutes from './routes/account.routes.js'
import chatRoutes from './routes/chat.routes.js'
import paymentRoutes from './routes/payment.routes.js'
import adminRoutes from './routes/admin.routes.js'
import memoriesRoutes from './routes/memories.routes.js'
import feedbackRoutes from './routes/feedback.routes.js'
import { startBillingScheduler } from './services/billingScheduler.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

// Connect to MongoDB
connectDatabase()

const app = express()

// 🛡️ CHỐNG GIẢ MẠO HEADER (IP SPOOFING): Chỉ tin tưởng X-Forwarded-For nếu request thực sự đến từ Nginx/Loopback nội bộ.
// Nếu hacker gọi trực tiếp vào Port máy chủ từ Internet, Express sẽ bỏ qua header giả mạo và lấy IP TCP thật của hacker!
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])

app.use(cors({ origin: env.clientOrigin, credentials: true }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

// PayPal verifies the original byte stream. Its route owns body parsing with
// express.raw(), so the JSON parser must not consume it first.
app.use(express.json({
  limit: '200kb',
  type: (req) => !req.originalUrl.startsWith('/api/payments/paypal/webhook'),
}))
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/account', accountRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/memories', memoriesRoutes)
app.use('/api/feedback', feedbackRoutes)

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Phục vụ tệp tĩnh Frontend trong môi trường Production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, '0.0.0.0', () => {
  console.log(`MedChat backend listening on http://0.0.0.0:${env.port}`)
  startBillingScheduler()
  if (process.env.NODE_ENV === 'production') {
    console.log('[startup] Production mode — all secrets must be real values.')
  } else if (!env.ninerouterApi) {
    console.log('[startup] WARNING: NINEROUTER_API not set — chat will return demo replies.')
  }
})
