import { Router } from 'express'
import Stripe from 'stripe'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { UserModel } from '../db/user.model.js'
import { PaymentModel } from '../db/payment.model.js'
import { toPublicUser } from '../db/usersRepo.js'
import { autoRenewSubscriptionForUser } from '../services/billingScheduler.js'

const router = Router()
const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null

router.use(requireAuth)

// ─── 1. LIÊN KẾT THẺ TÍN DỤNG (STRIPE / MOCK) ──────────────────────────────
router.post(
  '/link-card',
  asyncHandler(async (req, res) => {
    const { paymentMethodId, last4, brand } = req.body ?? {}
    const user = await UserModel.findOne({ id: req.userId })
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    if (stripe) {
      // TRƯỜNG HỢP A: Có cấu hình Stripe thật (Chạy thực tế / Test Mode)
      if (!paymentMethodId) {
        throw new HttpError(400, 'Thiếu Stripe PaymentMethod ID.')
      }

      let stripeCustomerId = user.billingToken
      if (user.billingMethod !== 'stripe' || !stripeCustomerId) {
        // Tạo mới Stripe Customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: user.id }
        })
        stripeCustomerId = customer.id
      }

      // Gắn PaymentMethod vào Customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId
      })

      // Đặt làm thẻ mặc định cho Customer
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })

      const updatedUser = await UserModel.findOneAndUpdate(
        { id: req.userId },
        {
          $set: {
            billingMethod: 'stripe',
            billingToken: stripeCustomerId,
            billingDetails: {
              paymentMethodId,
              brand: brand || 'Card',
              last4: last4 || '9999'
            },
            autoRenew: true,
            subscriptionStatus: user.planId === 'pro' ? 'active' : user.subscriptionStatus
          }
        },
        { new: true }
      ).lean()

      res.json({ success: true, user: toPublicUser(updatedUser) })
    } else {
      // TRƯỜNG HỢP B: Giả lập liên kết thẻ (Khi không có Stripe Key)
      console.log(`[Stripe Mock] Giả lập liên kết thẻ Visa/Mastercard cho User ${user.id}...`)
      
      const mockLast4 = last4 || '4242'
      const mockBrand = brand || 'Visa'
      
      const updatedUser = await UserModel.findOneAndUpdate(
        { id: req.userId },
        {
          $set: {
            billingMethod: 'stripe',
            billingToken: `cus_mock_${randomUUID().slice(0, 8)}`,
            billingDetails: {
              paymentMethodId: `pm_mock_${randomUUID().slice(0, 8)}`,
              brand: mockBrand,
              last4: mockLast4
            },
            autoRenew: true,
            // Nếu người dùng nâng cấp lần đầu, tự động kích hoạt thử nghiệm
            subscriptionStatus: user.planId === 'pro' ? 'active' : user.subscriptionStatus
          }
        },
        { new: true }
      ).lean()

      res.json({ success: true, user: toPublicUser(updatedUser), isMock: true })
    }
  })
)

// ─── 2. GIẢ LẬP LIÊN KẾT VÍ MOMO ──────────────────────────────────────────
router.post(
  '/link-momo',
  asyncHandler(async (req, res) => {
    const { phoneNumber, otp } = req.body ?? {}
    if (!phoneNumber) throw new HttpError(400, 'Số điện thoại Ví MoMo không được để trống.')
    if (!otp) throw new HttpError(400, 'Mã xác thực OTP không hợp lệ.')

    const user = await UserModel.findOne({ id: req.userId })
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    console.log(`[MoMo Link] Đang liên kết Ví MoMo số ${phoneNumber} cho User ${user.id}...`)

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: req.userId },
      {
        $set: {
          billingMethod: 'momo',
          billingToken: `tok_momo_${randomUUID().slice(0, 12)}`,
          billingDetails: {
            momoPhone: phoneNumber
          },
          autoRenew: true
        }
      },
      { new: true }
    ).lean()

    res.json({ success: true, user: toPublicUser(updatedUser) })
  })
)

// ─── 3. HỦY LIÊN KẾT THANH TOÁN TỰ ĐỘNG ────────────────────────────────────
router.post(
  '/unlink',
  asyncHandler(async (req, res) => {
    const updatedUser = await UserModel.findOneAndUpdate(
      { id: req.userId },
      {
        $set: {
          billingMethod: null,
          billingToken: null,
          billingDetails: null,
          autoRenew: false
        }
      },
      { new: true }
    ).lean()

    res.json({ success: true, user: toPublicUser(updatedUser) })
  })
)

// ─── 4. BẬT/TẮT TỰ ĐỘNG GIA HẠN ───────────────────────────────────────────
router.post(
  '/toggle-autorenew',
  asyncHandler(async (req, res) => {
    const { autoRenew } = req.body ?? {}
    const updatedUser = await UserModel.findOneAndUpdate(
      { id: req.userId },
      { $set: { autoRenew: !!autoRenew } },
      { new: true }
    ).lean()

    res.json({ success: true, user: toPublicUser(updatedUser) })
  })
)

// ─── 5. LẤY LỊCH SỬ HÓA ĐƠN/GIAO DỊCH ─────────────────────────────────────
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const history = await PaymentModel.find({ userId: req.userId }).sort({ createdAt: -1 }).lean()
    res.json({ history })
  })
)

// ─── 6. TRIGGER KIỂM THỬ GIA HẠN NGAY LẬP TỨC ──────────────────────────────
router.post(
  '/trigger-renew-test',
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOne({ id: req.userId }).lean()
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')
    if (!user.billingToken) throw new HttpError(400, 'Bạn cần liên kết Thẻ hoặc Ví MoMo để thử nghiệm tính năng này.')

    // Mô phỏng nâng cấp lên Pro bằng cách chạy hàm gia hạn
    // Để chạy thử được, trước tiên đặt autoRenew về true
    await UserModel.updateOne({ id: user.id }, { $set: { autoRenew: true } })
    const userWithRenew = await UserModel.findOne({ id: user.id }).lean()

    const result = await autoRenewSubscriptionForUser(userWithRenew)
    const refreshedUser = await UserModel.findOne({ id: user.id }).lean()

    res.json({
      success: result.success,
      error: result.error || null,
      user: toPublicUser(refreshedUser)
    })
  })
)

export default router
