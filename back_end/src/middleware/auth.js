import { AUTH_COOKIE_NAME, verifySessionToken } from '../utils/jwt.js'
import { UserModel } from '../db/user.model.js'
import { env } from '../config/env.js'

function extractToken(req) {
  if (req.cookies?.[AUTH_COOKIE_NAME]) return req.cookies[AUTH_COOKIE_NAME]
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  if (req.headers['x-session-token']) return req.headers['x-session-token']
  return null
}

export function requireAuth(req, res, next) {
  const token = extractToken(req)
  const userId = token ? verifySessionToken(token) : null
  if (!userId) {
    res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' })
    return
  }
  req.userId = userId
  next()
}

// For routes usable by both guests and logged-in users (e.g. chat), where
// we still want to attribute usage to an account when one is present.
export function attachUserIfPresent(req, _res, next) {
  const token = extractToken(req)
  req.userId = token ? verifySessionToken(token) : null
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
