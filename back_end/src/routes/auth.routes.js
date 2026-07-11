import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { AUTH_COOKIE_NAME, signSessionToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { DEFAULT_PLAN_ID } from '../config/plans.js'
import { verifyGoogleCredential } from '../services/googleAuthService.js'
import {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
} from '../db/usersRepo.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure, // set COOKIE_SECURE=true once served over HTTPS
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setSessionCookie(res, userId) {
  res.cookie(AUTH_COOKIE_NAME, signSessionToken(userId), COOKIE_OPTIONS)
}

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body ?? {}
    const trimmedName = (name ?? '').trim()
    const trimmedEmail = (email ?? '').trim().toLowerCase()

    if (!trimmedName) throw new HttpError(400, 'Vui lòng nhập họ tên.')
    if (!EMAIL_RE.test(trimmedEmail)) throw new HttpError(400, 'Email không hợp lệ.')
    if (!password || password.length < 6) {
      throw new HttpError(400, 'Mật khẩu cần tối thiểu 6 ký tự.')
    }

    if (await findUserByEmail(trimmedEmail)) {
      throw new HttpError(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await createUser({
      name: trimmedName,
      email: trimmedEmail,
      passwordHash,
      provider: 'form',
      planId: DEFAULT_PLAN_ID,
    })

    setSessionCookie(res, user.id)
    res.status(201).json({ user: toPublicUser(user) })
  }),
)

router.post(
  '/signin',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {}
    const trimmedEmail = (email ?? '').trim().toLowerCase()

    const user = await findUserByEmail(trimmedEmail)
    if (!user) {
      throw new HttpError(404, 'Không tìm thấy tài khoản với email này. Vui lòng đăng ký.')
    }
    if (user.provider !== 'form') {
      throw new HttpError(400, 'Email này đăng ký qua Google. Hãy dùng nút "Tiếp tục với Google".')
    }

    const passwordMatches = await bcrypt.compare(password ?? '', user.passwordHash)
    if (!passwordMatches) throw new HttpError(401, 'Mật khẩu không đúng.')

    setSessionCookie(res, user.id)
    res.json({ user: toPublicUser(user) })
  }),
)

router.post(
  '/google',
  asyncHandler(async (req, res) => {
    let verifiedEmail
    let verifiedName

    if (env.googleClientId) {
      // Real path: cryptographically verify the ID token from Google
      // Identity Services. Nothing here trusts client-supplied data.
      const { credential } = req.body ?? {}
      const payload = await verifyGoogleCredential(credential)
      verifiedEmail = payload.email
      verifiedName = payload.name
    } else {
      // ---------------------------------------------------------------
      // DEMO fallback, only reached when GOOGLE_CLIENT_ID isn't set. It
      // trusts an email the client hands us so the "Sign in with Google"
      // button still has something to demo against without Google Cloud
      // credentials. Never do this in production — see
      // services/googleAuthService.js for the real verification path.
      // ---------------------------------------------------------------
      const { email, name } = req.body ?? {}
      const trimmedEmail = (email ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(trimmedEmail)) throw new HttpError(400, 'Email không hợp lệ.')
      verifiedEmail = trimmedEmail
      verifiedName = name
    }

    let user = await findUserByEmail(verifiedEmail)
    if (user && user.provider !== 'google') {
      throw new HttpError(400, 'Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng biểu mẫu.')
    }
    if (!user) {
      user = await createUser({
        name: (verifiedName || verifiedEmail.split('@')[0]).trim(),
        email: verifiedEmail,
        passwordHash: null,
        provider: 'google',
        planId: DEFAULT_PLAN_ID,
      })
    }

    setSessionCookie(res, user.id)
    res.json({ user: toPublicUser(user) })
  }),
)

router.post('/signout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: undefined })
  res.status(204).end()
})

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.userId)
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')
    res.json({ user: toPublicUser(user) })
  }),
)

export default router
