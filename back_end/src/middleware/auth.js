import { AUTH_COOKIE_NAME, verifySessionToken } from '../utils/jwt.js'
import { UserModel } from '../db/user.model.js'
import { env } from '../config/env.js'
import { isSessionRevoked } from '../services/auth/authCache.js'

function extractToken(req) {
  if (req.cookies?.[AUTH_COOKIE_NAME]) return req.cookies[AUTH_COOKIE_NAME]
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  if (req.headers['x-session-token']) return req.headers['x-session-token']
  return null
}

async function verifyTokenWithRevocationCheck(token) {
  const payload = verifySessionToken(token)
  if (!payload) return null

  // `verifySessionToken` normalizes every accepted token type into an object
  // ({ userId, jti? }). Defensive string-coercion is kept here in case the
  // jwt helper is ever refactored to return a raw subject again.
  const userId = typeof payload === 'string' ? payload : payload.userId
  if (!userId) return null

  // Check if this session has been revoked (e.g. user logged out). Only
  // web session tokens carry a jti; mobile access tokens are short-lived
  // and not individually revocable, so they always pass this check.
  if (payload.jti && (await isSessionRevoked(payload.jti))) {
    return null
  }

  return userId
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req)
  const userId = token ? await verifyTokenWithRevocationCheck(token) : null
  if (!userId) {
    res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' })
    return
  }
  req.userId = userId
  next()
}

// For routes usable by both guests and logged-in users (e.g. chat), where
// we still want to attribute usage to an account when one is present.
export async function attachUserIfPresent(req, _res, next) {
  const token = extractToken(req)
  req.userId = token ? await verifyTokenWithRevocationCheck(token) : null
  next()
}

export async function requireAdmin(req, res, next) {
  if (!req.userId) {
    res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' })
    return
  }
  const user = await UserModel.findOne({ id: req.userId }).lean()
  const isAdmin = user && (user.role === 'admin' || user.email === env.adminEmail)
  if (!isAdmin) {
    res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này.' })
    return
  }
  next()
}