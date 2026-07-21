import { AUTH_COOKIE_NAME, verifySessionToken } from '../utils/jwt.js'
import { UserModel } from '../db/user.model.js'
import { env } from '../config/env.js'

export function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME]
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
  const token = req.cookies?.[AUTH_COOKIE_NAME]
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
