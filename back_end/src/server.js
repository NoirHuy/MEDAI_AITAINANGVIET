import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import accountRoutes from './routes/account.routes.js'
import chatRoutes from './routes/chat.routes.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: env.clientOrigin, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/account', accountRoutes)
app.use('/api/chat', chatRoutes)

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

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`MedChat backend listening on http://localhost:${env.port}`)
  if (!env.openrouterApiKey) {
    console.log('OPENROUTER_API_KEY not set — /api/chat is using the mock reply generator.')
  } else {
    console.log(`OpenRouter API active — using model: ${env.openrouterModel}`)
  }
})
