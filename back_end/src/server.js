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

import fs from 'fs'

// Phục vụ tệp tĩnh Frontend trong môi trường Production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist')
  const indexPath = path.join(distPath, 'index.html')
  console.log(`[Production Static] distPath: "${distPath}", exists: ${fs.existsSync(distPath)}`)
  console.log(`[Production Static] indexPath: "${indexPath}", exists: ${fs.existsSync(indexPath)}`)

  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[Static sendFile Error] path: "${indexPath}":`, err)
        next(err)
      }
    })
  })
}

app.get('/api/error-log', (req, res) => {
  res.json({
    ok: true,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      __dirname: __dirname,
      distPathResolved: path.resolve(__dirname, '../../dist'),
      distExists: fs.existsSync(path.resolve(__dirname, '../../dist')),
      indexExists: fs.existsSync(path.resolve(__dirname, '../../dist/index.html'))
    },
    errors: global.serverErrors || []
  })
})

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
