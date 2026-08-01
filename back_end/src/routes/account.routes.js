import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  accountPasswordLimiter,
  accountGeneralLimiter,
} from '../middleware/rateLimiters.js'
import { getPlan, isValidPlanId } from '../config/plans.js'
import { findUserById, updateUser, toPublicUser } from '../db/usersRepo.js'

const router = Router()

router.use(requireAuth)

router.patch(
  '/name',
  accountGeneralLimiter,
  asyncHandler(async (req, res) => {
    const name = (req.body?.name ?? '').trim()
    if (!name) throw new HttpError(400, 'Tên hiển thị không được để trống.')
    const user = await updateUser(req.userId, { name })
    res.json({ user: toPublicUser(user) })
  }),
)

router.patch(
  '/plan',
  accountGeneralLimiter,
  asyncHandler(async (req, res) => {
    const { planId } = req.body ?? {}
    if (!isValidPlanId(planId)) throw new HttpError(400, 'Gói thuê bao không hợp lệ.')

    const user = await findUserById(req.userId)
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    if (planId === 'free' && user.planId === 'pro') {
      throw new HttpError(400, 'Tài khoản đang trong thời hạn gói Pro. Bạn có thể tắt "Gia hạn tự động" trong mục Thanh toán để hệ thống tự chuyển về Miễn phí khi hết hạn.')
    }

    if (planId === 'pro' && user.planId !== 'pro') {
      throw new HttpError(400, 'Để nâng cấp lên gói Pro, vui lòng hoàn tất thanh toán qua PayPal.')
    }

    const patch = { planId }
    if (planId === 'free') {
      patch.subscriptionStatus = 'none'
      patch.subscriptionExpiresAt = null
      patch.autoRenew = false
    }

    const updatedUser = await updateUser(req.userId, patch)
    res.json({ user: toPublicUser(updatedUser), message: 'Cập nhật gói tài khoản thành công.' })
  }),
)

router.patch(
  '/autorenew',
  accountGeneralLimiter,
  asyncHandler(async (req, res) => {
    const { autoRenew } = req.body ?? {}
    const user = await updateUser(req.userId, { autoRenew: !!autoRenew })
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

router.patch(
  '/password',
  accountPasswordLimiter,
  asyncHandler(async (req, res) => {
    const bcrypt = await import('bcryptjs').then(m => m.default)
    const { oldPassword, newPassword } = req.body ?? {}
    if (!newPassword || newPassword.trim().length < 6) {
      throw new HttpError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự.')
    }

    const user = await findUserById(req.userId)
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')
    if (user.provider === 'google') {
      throw new HttpError(400, 'Tài khoản đăng nhập bằng Google không sử dụng mật khẩu.')
    }

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(oldPassword || '', user.passwordHash)
      if (!isMatch) throw new HttpError(400, 'Mật khẩu cũ không chính xác.')
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(newPassword, salt)
    
    await updateUser(req.userId, { passwordHash })
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' })
  }),
)

export default router
