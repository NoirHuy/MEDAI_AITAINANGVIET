import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const EXPIRES_IN = '7d'
export const AUTH_COOKIE_NAME = 'medchat_token'

export function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: EXPIRES_IN })
}

export function verifySessionToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    return payload.sub
  } catch {
    return null
  }
}
