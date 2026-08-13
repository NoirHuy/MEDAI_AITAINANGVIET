import { describe, expect, it } from 'vitest'
import {
  signMobileAccessToken,
  signMobileRefreshToken,
  signSessionToken,
  verifyMobileRefreshToken,
  verifySessionToken,
} from './jwt.js'

describe('token types', () => {
  it('accepts web and mobile access tokens for authenticated requests', () => {
    const web = signSessionToken('user-1')
    const mobile = signMobileAccessToken('user-2')
    // web_session now returns { userId, jti } so we can revoke it
    expect(verifySessionToken(web.token)).toEqual({ userId: 'user-1', jti: expect.any(String) })
    // mobile_access still returns the raw user id (no jti needed; short-lived)
    expect(verifySessionToken(mobile)).toBe('user-2')
  })

  it('does not accept a refresh token as an API credential', () => {
    const refresh = signMobileRefreshToken('user-1')
    expect(verifySessionToken(refresh.token)).toBeNull()
    expect(verifyMobileRefreshToken(refresh.token)).toMatchObject({ userId: 'user-1', tokenId: refresh.tokenId })
  })
})
