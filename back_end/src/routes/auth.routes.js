import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { AUTH_COOKIE_NAME, signSessionToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import {
  authSigninLimiter,
  authSignupLimiter,
  authGoogleLimiter,
  authGeneralLimiter,
} from '../middleware/rateLimiters.js'
import { env } from '../config/env.js'
import { DEFAULT_PLAN_ID } from '../config/plans.js'
import { verifyGoogleCredential } from '../services/googleAuthService.js'
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  toPublicUser,
} from '../db/usersRepo.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isSecureCookie = env.cookieSecure
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isSecureCookie ? 'none' : 'lax',
  secure: isSecureCookie,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setSessionCookie(res, userId) {
  res.cookie(AUTH_COOKIE_NAME, signSessionToken(userId), COOKIE_OPTIONS)
}

router.get(
  '/config',
  authGeneralLimiter,
  asyncHandler(async (_req, res) => {
    res.json({
      googleClientId: env.googleClientId || null,
    })
  }),
)

router.post(
  '/signup',
  authSignupLimiter,
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
  authSigninLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {}
    const trimmedEmail = (email ?? '').trim().toLowerCase()

    const user = await findUserByEmail(trimmedEmail)
    if (!user) {
      throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.')
    }
    if (user.provider !== 'form') {
      throw new HttpError(400, 'Tài khoản này được đăng ký qua Google. Vui lòng nhấn nút "Tiếp tục với Google".')
    }

    const passwordMatches = await bcrypt.compare(password ?? '', user.passwordHash)
    if (!passwordMatches) throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.')

    setSessionCookie(res, user.id)
    res.json({ user: toPublicUser(user) })
  }),
)

router.post(
  '/google',
  authGoogleLimiter,
  asyncHandler(async (req, res) => {
    let verifiedEmail
    let verifiedName
    let verifiedPicture

    if (env.googleClientId) {
      const { credential } = req.body ?? {}
      const payload = await verifyGoogleCredential(credential)
      verifiedEmail = payload.email
      verifiedName = payload.name
      verifiedPicture = payload.picture
    } else {
      const { email, name, picture } = req.body ?? {}
      const trimmedEmail = (email ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(trimmedEmail)) throw new HttpError(400, 'Email không hợp lệ.')
      verifiedEmail = trimmedEmail
      verifiedName = name
      verifiedPicture = picture
    }

    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(verifiedName || verifiedEmail.split('@')[0])}&background=1a73e8&color=ffffff&bold=true`
    const finalPicture = verifiedPicture || defaultAvatarUrl

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
        picture: finalPicture,
      })
    } else {
      if (!user.picture || (verifiedPicture && user.picture !== verifiedPicture)) {
        user = await updateUser(user.id, { picture: finalPicture })
      }
    }

    setSessionCookie(res, user.id)
    res.json({ user: toPublicUser(user) })
  }),
)

router.post('/signout', authGeneralLimiter, (_req, res) => {
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
