import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.js'
import { paymentLimiter } from '../middleware/rateLimiters.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { UserModel } from '../db/user.model.js'
import { PaymentModel } from '../db/payment.model.js'
import { toPublicUser } from '../db/usersRepo.js'
import { createPayPalOrder, capturePayPalOrder } from '../services/paypalClient.js'

const router = Router()

// ─── 0. PAYPAL PUBLIC CONFIG (Client ID & Mode for Frontend Buttons) ────────
router.get('/config', (req, res) => {
  res.json({
    clientId: env.paypalClientId,
    mode: env.paypalMode,
    isConfigured: !!(env.paypalClientId && env.paypalClientSecret)
  })
})

router.use(requireAuth)

// ─── 1. CREATE PAYPAL ORDER ──────────────────────────────────────────────────
router.post(
  '/paypal/create-order',
  paymentLimiter,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOne({ id: req.userId })
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    if (!env.paypalClientId || !env.paypalClientSecret) {
      throw new HttpError(500, 'Hệ thống chưa cấu hình PayPal API Key (PAYPAL_CLIENT_ID và PAYPAL_CLIENT_SECRET).')
    }

    try {
      const order = await createPayPalOrder({
        amountUSD: '3.99',
        description: `MedChat Pro Plan Subscription (30 Days) - User: ${user.email}`
      })
      res.json({ orderId: order.id })
    } catch (err) {
      throw new HttpError(500, `Không thể tạo đơn hàng PayPal: ${err.message}`)
    }
  })
)

// ─── 2. CAPTURE PAYPAL ORDER & UPGRADE TO PRO ──────────────────────────────
router.post(
  '/paypal/capture-order',
  paymentLimiter,
  asyncHandler(async (req, res) => {
    const { orderId } = req.body ?? {}
    if (!orderId || typeof orderId !== 'string') throw new HttpError(400, 'Thiếu PayPal Order ID hợp lệ.')

    const user = await UserModel.findOne({ id: req.userId })
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.')

    if (!env.paypalClientId || !env.paypalClientSecret) {
      throw new HttpError(500, 'Hệ thống chưa cấu hình PayPal API Key.')
    }

    // 🛡️ CHỐNG TÁI SỬ DỤNG MÃ ĐƠN HÀNG (Anti-Replay Attack)
    const existingPayment = await PaymentModel.findOne({ billingToken: orderId })
    if (existingPayment) {
      throw new HttpError(400, 'Đơn hàng PayPal này đã được xử lý và ghi nhận trước đó.')
    }

    let captureResult
    try {
      captureResult = await capturePayPalOrder(orderId)
      if (captureResult.status !== 'COMPLETED') {
        throw new HttpError(400, `Thanh toán PayPal chưa hoàn tất (Trạng thái: ${captureResult.status})`)
      }

      const capturedAmount = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value
      const capturedCurrency = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code

      if (capturedAmount !== '3.99' || capturedCurrency !== 'USD') {
        console.error(`[PAYPAL AUDIT ALERT] Detected price mismatch for order ${orderId}: Expected $3.99 USD, got ${capturedAmount} ${capturedCurrency}`)
        throw new HttpError(400, 'Giao dịch bị từ chối do số tiền thanh toán không đúng hạn mức gói Pro ($3.99 USD).')
      }
    } catch (err) {
      throw new HttpError(400, `Thanh toán PayPal thất bại: ${err.message}`)
    }

    const paymentRecord = new PaymentModel({
      id: `pay_${Date.now()}_${randomUUID().slice(0, 6)}`,
      userId: user.id,
      planId: 'pro',
      amount: 99000,
      status: 'success',
      type: 'initial',
      paymentGateway: 'paypal',
      billingToken: orderId,
      createdAt: new Date(),
      completedAt: new Date()
    })
    await paymentRecord.save()

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: req.userId },
      {
        $set: {
          planId: 'pro',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt,
          billingMethod: 'paypal',
          billingToken: orderId,
          billingDetails: {
            paypalPayerId: captureResult?.payer?.payer_id || 'paypal_payer_sandbox',
            paypalEmail: captureResult?.payer?.email_address || user.email,
            capturedAt: new Date().toISOString()
          },
          autoRenew: true
        }
      },
      { new: true }
    ).lean()

    res.json({
      success: true,
      message: 'Thanh toán thành công qua PayPal! Tài khoản của bạn đã được nâng cấp lên gói Pro (30 ngày).',
      user: toPublicUser(updatedUser)
    })
  })
)

// ─── 3. HỦY LIÊN KẾT THANH TOÁN ────────────────────────────────────────────
router.post(
  '/unlink',
  paymentLimiter,
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
  paymentLimiter,
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

export default router
