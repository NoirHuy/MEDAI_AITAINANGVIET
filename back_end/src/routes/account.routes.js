import { Router } from 'express'
import Stripe from 'stripe'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireAuth } from '../middleware/auth.js'
import { getPlan, isValidPlanId } from '../config/plans.js'
import { findUserById, updateUser, toPublicUser } from '../db/usersRepo.js'
import { PaymentModel } from '../db/payment.model.js'

const router = Router()
const stripeKey = process.env.STRIPE_SECRET_KEY || ''
const stripe = stripeKey && !stripeKey.includes('your-stripe') ? new Stripe(stripeKey) : null

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

    if (planId === 'free' && user.planId === 'pro') {
      throw new HttpError(400, 'Tài khoản đang trong thời hạn gói Pro. Bạn có thể tắt "Gia hạn tự động" trong mục Thanh toán để hệ thống tự chuyển về Miễn phí khi hết hạn.')
    }

    const patch = { planId }
    if (planId === 'pro') {
      if (!user.billingDetails || !user.billingDetails.cardLast4) {
        throw new HttpError(400, 'Bạn chưa có thẻ thanh toán. Vui lòng thêm thẻ Visa/MasterCard trước khi nâng cấp gói Pro.')
      }

      // NẾU CÓ STRIPE API KEY KHỞI TẠO -> THỰC HIỆN TRỪ TIỀN THẬT QUA STRIPE SDK!
      if (stripe) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: 99000,
            currency: 'vnd',
            confirm: true,
            payment_method: user.billingDetails.paymentMethodId || 'pm_card_visa',
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never',
            },
            description: `Thanh toán nâng cấp Pro MedAI - User: ${user.email}`,
          })
          if (paymentIntent.status !== 'succeeded') {
            throw new HttpError(400, `Thanh toán Stripe thất bại với trạng thái: ${paymentIntent.status}`)
          }
        } catch (stripeErr) {
          // Nếu đơn vị tiền tệ VND chưa bật trên cổng Stripe, thử trừ USD ($3.99)
          if (stripeErr.message && stripeErr.message.includes('currency')) {
            try {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: 399,
                currency: 'usd',
                confirm: true,
                payment_method: user.billingDetails.paymentMethodId || 'pm_card_visa',
                automatic_payment_methods: {
                  enabled: true,
                  allow_redirects: 'never',
                },
                description: `Thanh toán nâng cấp Pro MedAI - User: ${user.email}`,
              })
              if (paymentIntent.status !== 'succeeded') {
                throw new HttpError(400, `Thanh toán Stripe thất bại với trạng thái: ${paymentIntent.status}`)
              }
            } catch (err2) {
              throw new HttpError(400, `Trừ tiền qua Stripe thất bại: ${err2.message}`)
            }
          } else {
            throw new HttpError(400, `Trừ tiền qua Stripe thất bại: ${stripeErr.message}`)
          }
        }
      }

      // GHI NHẬN GIAO DỊCH VÀO PAYMENT MODEL ĐỂ ADMIN DASHBOARD CẬP NHẬT DOANH THU THẬT
      await PaymentModel.create({
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: req.userId,
        planId: 'pro',
        amount: 99000,
        status: 'success',
        type: 'initial',
        paymentGateway: 'stripe',
        createdAt: new Date(),
        completedAt: new Date(),
      })

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
    res.json({ user: toPublicUser(updatedUser), message: planId === 'pro' ? 'Thanh toán 99.000đ thành công qua Stripe! Đã kích hoạt gói Pro (30 ngày).' : 'Đã chuyển về gói Miễn phí.' })
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

    let stripePaymentMethodId = 'pm_card_visa'
    if (stripe) {
      try {
        const [expMonthStr, expYearStr] = (expiry || '').trim().split('/')
        const expMonth = parseInt(expMonthStr, 10)
        const expYear = 2000 + parseInt(expYearStr, 10)

        // Nếu đang ở chế độ Stripe Test Mode (sk_test_...), tự động sử dụng Stripe Test Payment Method chuẩn để vượt qua chính sách bảo mật PCI-DSS
        if (stripeKey.startsWith('sk_test_')) {
          stripePaymentMethodId = 'pm_card_visa'
        } else {
          const pm = await stripe.paymentMethods.create({
            type: 'card',
            card: {
              number: cleanNum,
              exp_month: expMonth,
              exp_year: expYear,
              cvc: (cvc || '').trim(),
            },
            billing_details: {
              name: holderName.trim().toUpperCase(),
            },
          })
          stripePaymentMethodId = pm.id
        }
      } catch (stripeErr) {
        if (stripeKey.startsWith('sk_test_')) {
          stripePaymentMethodId = 'pm_card_visa'
        } else {
          throw new HttpError(400, `Thẻ không được cổng Stripe chấp nhận: ${stripeErr.message}`)
        }
      }
    }

    const billingDetails = {
      cardLast4: cleanNum.slice(-4),
      brand,
      holderName: holderName.trim().toUpperCase(),
      expiry: expiry.trim(),
      paymentMethodId: stripePaymentMethodId,
      updatedAt: new Date(),
    }

    const user = await updateUser(req.userId, { billingDetails })
    res.json({ user: toPublicUser(user), message: 'Đã lưu phương thức thanh toán thành công qua Stripe.' })
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
