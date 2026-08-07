import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../config/env.js', () => ({
  env: {
    googleClientId: null,
    jwtSecret: 'test-secret',
    cookieSecure: false,
  },
}))

vi.mock('../db/usersRepo.js', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  updateUser: vi.fn(),
  toPublicUser: (u) => u,
}))

vi.mock('../services/googleAuthService.js', () => ({
  verifyGoogleCredential: vi.fn(),
}))

vi.mock('../services/mobileToken.service.js', () => ({
  issueMobileTokens: vi.fn(),
  revokeMobileRefreshToken: vi.fn(),
  rotateMobileRefreshToken: vi.fn(),
}))

vi.mock('../utils/jwt.js', () => ({
  AUTH_COOKIE_NAME: 'medchat_token',
  signSessionToken: vi.fn(() => 'signed.jwt.value'),
}))

const { default: authRouter } = await import('./auth.routes.js')
const express = (await import('express')).default
const supertest = (await import('supertest')).default

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  // Minimal error handler mirroring production middleware shape.
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message })
  })
  return app
}

describe('POST /api/auth/google', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unverified credential flow when GOOGLE_CLIENT_ID is not configured', async () => {
    const app = buildApp()
    const res = await supertest(app)
      .post('/api/auth/google')
      .send({ email: 'admin@medchat247.ai', name: 'Attacker' })

    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/chưa được cấu hình/i)
  })

  it('does not call the unverified credential branch even when credential is provided', async () => {
    const { verifyGoogleCredential } = await import('../services/googleAuthService.js')
    const { findUserByEmail, createUser } = await import('../db/usersRepo.js')

    const app = buildApp()
    const res = await supertest(app)
      .post('/api/auth/google')
      .send({ credential: 'fake.token', email: 'admin@medchat247.ai' })

    expect(res.status).toBe(503)
    expect(verifyGoogleCredential).not.toHaveBeenCalled()
    expect(findUserByEmail).not.toHaveBeenCalled()
    expect(createUser).not.toHaveBeenCalled()
  })
})
