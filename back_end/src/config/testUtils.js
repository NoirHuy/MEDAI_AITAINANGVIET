import crypto from 'node:crypto'

// ─── Plans config ─────────────────────────────────────────────────────────────

export const PLANS = [
  { id: 'free', tokenLimit: 50000 },
  { id: 'pro', tokenLimit: 2000000 },
]

export function getPlan(planId) {
  return PLANS.find(p => p.id === planId) ?? PLANS[0]
}

export function isValidPlanId(planId) {
  return PLANS.some(p => p.id === planId)
}

// ─── Env helpers ─────────────────────────────────────────────────────────────

const _random = crypto.randomBytes(8).toString('hex')
export const PLACEHOLDER_SECRET = `PLACEHOLDER-${_random}`

// ─── Test seed data ───────────────────────────────────────────────────────────

export const TEST_USERS = {
  free: {
    id: 'user_free_001',
    email: 'free@test.com',
    name: 'Free User',
    planId: 'free',
    provider: 'google',
    subscriptionStatus: 'none',
    subscriptionExpiresAt: null,
    autoRenew: false,
    tokensUsed: 0,
    createdAt: new Date().toISOString(),
  },
  pro: {
    id: 'user_pro_001',
    email: 'pro@test.com',
    name: 'Pro User',
    planId: 'pro',
    provider: 'paypal',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    autoRenew: true,
    tokensUsed: 0,
    createdAt: new Date().toISOString(),
  },
}
