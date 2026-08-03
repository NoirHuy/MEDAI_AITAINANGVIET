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
import {
  issueMobileTokens,
  revokeMobileRefreshToken,
  rotateMobileRefreshToken,
} from '../services/mobileToken.service.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isSecureCookie = env.cookieSecure
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isSecureCookie,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setSessionCookie(res, userId) {
  res.cookie(AUTH_COOKIE_NAME, signSessionToken(userId), COOKIE_OPTIONS)
}

function isMobileClient(req) {
  return req.body?.client === 'mobile'
}

async function sendAuthenticated(res, req, user, status = 200) {
  if (isMobileClient(req)) {
    const tokens = await issueMobileTokens(user.id)
    return res.status(status).json({ user: toPublicUser(user), tokens })
  }
  setSessionCookie(res, user.id)
  return res.status(status).json({ user: toPublicUser(user) })
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

    await sendAuthenticated(res, req, user, 201)
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

    await sendAuthenticated(res, req, user)
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

    await sendAuthenticated(res, req, user)
  }),
)

router.post('/signout', authGeneralLimiter, (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: undefined })
  res.status(204).end()
})

router.post(
  '/mobile/refresh',
  authGeneralLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {}
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new HttpError(400, 'A refresh token is required.')
    }
    const tokens = await rotateMobileRefreshToken(refreshToken)
    if (!tokens) throw new HttpError(401, 'Invalid or expired refresh token.')
    res.json({ tokens })
  }),
)

router.post(
  '/mobile/signout',
  requireAuth,
  authGeneralLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {}
    if (typeof refreshToken === 'string' && refreshToken) {
      await revokeMobileRefreshToken(req.userId, refreshToken)
    }
    res.status(204).end()
  }),
)

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
