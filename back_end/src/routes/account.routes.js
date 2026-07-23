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
    const { planId } = req.body ?? {}
    if (!isValidPlanId(planId)) throw new HttpError(400, 'Gói thuê bao không hợp lệ.')

    const user = await findUserById(req.userId)
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    const patch = { planId }
    if (planId === 'pro') {
      if (!user.billingDetails || !user.billingDetails.cardLast4) {
        throw new HttpError(400, 'Bạn chưa có thẻ thanh toán. Vui lòng thêm thẻ Visa/MasterCard trước khi nâng cấp gói Pro.')
      }
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      patch.subscriptionStatus = 'active'
      patch.subscriptionExpiresAt = expiresAt
      patch.autoRenew = true
    } else {
      patch.subscriptionStatus = 'none'
      patch.subscriptionExpiresAt = null
    }

    const updatedUser = await updateUser(req.userId, patch)
    res.json({ user: toPublicUser(updatedUser), message: planId === 'pro' ? 'Thanh toán 99.000đ thành công! Đã kích hoạt gói Pro (30 ngày).' : 'Đã chuyển về gói Miễn phí.' })
  }),
)

router.patch(
  '/card',
  asyncHandler(async (req, res) => {
    const { cardNumber, holderName, expiry, cvc } = req.body ?? {}
    const cleanNum = (cardNumber || '').replace(/\s+/g, '')
    if (cleanNum.length < 13 || cleanNum.length > 19) {
      throw new HttpError(400, 'Số thẻ Visa/Mastercard không hợp lệ (phải từ 13 - 19 chữ số).')
    }
    if (!(holderName || '').trim()) {
      throw new HttpError(400, 'Tên chủ thẻ không được để trống.')
    }
    if (!/^\d{2}\/\d{2}$/.test((expiry || '').trim())) {
      throw new HttpError(400, 'Ngày hết hạn thẻ phải đúng định dạng MM/YY.')
    }
    if (!/^\d{3,4}$/.test((cvc || '').trim())) {
      throw new HttpError(400, 'Mã CVV/CVC phải gồm 3 hoặc 4 chữ số.')
    }

    let brand = 'Visa / Mastercard'
    if (cleanNum.startsWith('4')) brand = 'Visa'
    else if (/^5[1-5]/.test(cleanNum)) brand = 'Mastercard'
    else if (/^3[47]/.test(cleanNum)) brand = 'American Express'
    else if (/^35/.test(cleanNum)) brand = 'JCB'

    const billingDetails = {
      cardLast4: cleanNum.slice(-4),
      brand,
      holderName: holderName.trim().toUpperCase(),
      expiry: expiry.trim(),
      updatedAt: new Date(),
    }

    const user = await updateUser(req.userId, { billingDetails })
    res.json({ user: toPublicUser(user), message: 'Đã lưu phương thức thanh toán thành công.' })
  }),
)

router.delete(
  '/card',
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.userId, { billingDetails: null })
    res.json({ user: toPublicUser(user), message: 'Đã xóa thẻ thanh toán thành công.' })
  }),
)

router.patch(
  '/autorenew',
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
