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
import { UserModel } from '../db/user.model.js'
import { ConversationModel } from '../db/conversation.model.js'
import { SubscriptionModel } from '../db/subscription.model.js'
import { FeedbackModel } from '../db/feedback.model.js'
import { UserMemoryModel } from '../db/user_memory.model.js'
import { UserMemorySettingsModel } from '../db/user_memory_settings.model.js'
import { MemoryAuditModel } from '../db/memory_audit.model.js'
import { MobileRefreshTokenModel } from '../db/mobile_refresh_token.model.js'
import { PaymentModel } from '../db/payment.model.js'
import { AUTH_COOKIE_NAME } from '../utils/jwt.js'

const router = Router()

router.use(requireAuth)

router.delete(
  '/delete',
  accountPasswordLimiter,
  asyncHandler(async (req, res) => {
    const confirmation = req.body?.confirmation
    if (confirmation !== 'DELETE') {
      throw new HttpError(400, 'Vui lòng nhập chính xác DELETE để xác nhận xóa tài khoản.')
    }

    const user = await findUserById(req.userId)
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    // Remove user-owned personal data. Payment records remain for financial
    // reconciliation, but their direct user reference is anonymized.
    await Promise.all([
      ConversationModel.deleteMany({ userId: req.userId }),
      FeedbackModel.deleteMany({ userId: req.userId }),
      UserMemoryModel.deleteMany({ userId: req.userId }),
      UserMemorySettingsModel.deleteOne({ userId: req.userId }),
      MemoryAuditModel.deleteMany({ userId: req.userId }),
      SubscriptionModel.deleteMany({ userId: req.userId }),
      MobileRefreshTokenModel.deleteMany({ userId: req.userId }),
      PaymentModel.updateMany({ userId: req.userId }, { $set: { userId: 'deleted' } }),
      UserModel.deleteOne({ id: req.userId }),
    ])

    res.clearCookie(AUTH_COOKIE_NAME)
    res.json({ success: true, message: 'Tài khoản và dữ liệu cá nhân đã được xóa.' })
  }),
)

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

    // Only planId=free is allowed here. Pro upgrades MUST go through the
    // PayPal capture flow (POST /api/payments/paypal/capture-order).
    if (planId === 'pro') {
      throw new HttpError(403, 'Vui lòng sử dụng thanh toán PayPal để nâng cấp gói Pro.')
    }

    const patch = { planId: 'free' }
    patch.subscriptionStatus = 'none'
    patch.subscriptionExpiresAt = null
    patch.autoRenew = false

    const updatedUser = await updateUser(req.userId, patch)
    res.json({ user: toPublicUser(updatedUser), message: 'Đã chuyển về gói Miễn phí.' })
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
