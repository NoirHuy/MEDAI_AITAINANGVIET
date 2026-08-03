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
    expect(verifySessionToken(signSessionToken('user-1'))).toBe('user-1')
    expect(verifySessionToken(signMobileAccessToken('user-2'))).toBe('user-2')
  })

  it('does not accept a refresh token as an API credential', () => {
    const refresh = signMobileRefreshToken('user-1')
    expect(verifySessionToken(refresh.token)).toBeNull()
    expect(verifyMobileRefreshToken(refresh.token)).toMatchObject({ userId: 'user-1', tokenId: refresh.tokenId })
  })
})
