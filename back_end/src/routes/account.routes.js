import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireAuth } from '../middleware/auth.js'
import { getPlan, isValidPlanId } from '../config/plans.js'
import { findUserById, updateUser, toPublicUser } from '../db/usersRepo.js'

const router = Router()

router.use(requireAuth)

router.patch(
  '/name',
  asyncHandler(async (req, res) => {
    const name = (req.body?.name ?? '').trim()
    if (!name) throw new HttpError(400, 'Tên hiển thị không được để trống.')
    const user = await updateUser(req.userId, { name })
    res.json({ user: toPublicUser(user) })
  }),
)

router.patch(
  '/plan',
  asyncHandler(async (req, res) => {
    // ---------------------------------------------------------------------
    // MOCK plan change: flips the stored planId with no payment step. A
    // real implementation must only change the plan after a payment
    // provider (Stripe/VNPay/Momo...) confirms the charge, typically via a
    // webhook, not directly from a client request like this one.
    // ---------------------------------------------------------------------
    const { planId } = req.body ?? {}
    if (!isValidPlanId(planId)) throw new HttpError(400, 'Gói thuê bao không hợp lệ.')
    const user = await updateUser(req.userId, { planId })
    res.json({ user: toPublicUser(user) })
  }),
)

router.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.userId)
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')
    const plan = getPlan(user.planId)
    res.json({ planId: plan.id, tokenLimit: plan.tokenLimit, tokensUsed: user.tokensUsed ?? 0 })
  }),
)

export default router
