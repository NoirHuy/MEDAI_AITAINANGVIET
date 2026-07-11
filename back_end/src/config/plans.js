// Mirrors src/data/account.js on the frontend. Keep the ids and token
// limits in sync with that file.
export const DEFAULT_PLAN_ID = 'free'

export const PLANS = [
  { id: 'free', tokenLimit: 50000 },
  { id: 'pro', tokenLimit: 2000000 },
]

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0]
}

export function isValidPlanId(planId) {
  return PLANS.some((p) => p.id === planId)
}
