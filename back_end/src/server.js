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
import { startBillingScheduler } from './services/billingScheduler.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

// Connect to MongoDB
connectDatabase()

const app = express()

app.use(cors({ origin: env.clientOrigin, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/account', accountRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/admin', adminRoutes)

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


// Phục vụ tệp tĩnh Frontend trong môi trường Production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    // Các route API không khớp thì để errorHandler lo
    if (req.path.startsWith('/api/')) return next()
    // SPA fallback: Chuyển hướng các request thường về index.html
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.get('/api/error-log', (req, res) => {
  res.json({
    ok: true,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
    },
    errors: global.serverErrors || []
  })
})

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, '0.0.0.0', () => {
  console.log(`MedChat backend listening on http://0.0.0.0:${env.port}`)
  startBillingScheduler()
  if (!env.openrouterApiKey) {
    console.log('OPENROUTER_API_KEY not set — /api/chat is using the mock reply generator.')
  } else {
    console.log(`OpenRouter API active — using model: ${env.openrouterModel}`)
  }
})
