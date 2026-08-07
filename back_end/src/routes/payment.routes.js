import { Router, raw } from 'express'
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
import {
  verifyPayPalWebhookSignature,
  parsePayPalCustom,
} from '../utils/paypal-webhook.util.js'
import { auditLog } from '../utils/auditLog.js'
import {
  upsertSubscriptionAndSync,
  cancelSubscriptionAndSync,
} from '../services/subscription.service.js'

const router = Router()

// ─── 0. PAYPAL PUBLIC CONFIG (Client ID & Mode for Frontend Buttons) ────────
router.get('/config', (req, res) => {
  res.json({
    clientId: env.paypalClientId,
    mode: env.paypalMode,
    isConfigured: !!(env.paypalClientId && env.paypalClientSecret)
  })
})

// ─── 0.5 PAYPAL WEBHOOK (Public — no JWT) ────────────────────────────────────
// PayPal gọi đến endpoint này khi có event (payment.completed, refunded, ...).
// Phải đặt TRƯỚC router.use(requireAuth) vì PayPal không gửi JWT.
router.post(
  '/paypal/webhook',
  raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    let event
    try {
      // req.body là Buffer do dùng raw()
      event = JSON.parse(req.body.toString('utf8'))
    } catch (err) {
      auditLog('PAYPAL_WEBHOOK', 'Error', `Invalid JSON body: ${err.message}`, 'error')
      return res.status(400).json({ error: 'Invalid JSON' })
    }

    // 1. Verify signature
    const verifyResult = await verifyPayPalWebhookSignature(req.headers, event)
    if (!verifyResult.valid) {
      auditLog('PAYPAL_WEBHOOK', 'Warn', `Signature invalid: ${verifyResult.reason}`, 'warn')
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const eventType = event.event_type
    const resource = event.resource || {}
    const purchaseUnit = resource.purchase_units?.[0] || {}
    const custom = parsePayPalCustom(
      resource.custom || resource.custom_id || purchaseUnit.custom || purchaseUnit.custom_id,
    )
    // A completed capture has its own resource.id. Preserve the checkout order
    // ID as the canonical subscription/payment key so refunds can revoke it.
    const relatedOrderId = resource.supplementary_data?.related_ids?.order_id
      || resource.invoice_id
      || resource.billing_agreement_id
    const captureId = resource.id || null
    const paymentLookup = relatedOrderId || captureId
    const existingPayment = paymentLookup
      ? await PaymentModel.findOne({
          $or: [{ billingToken: paymentLookup }, { paypalCaptureId: paymentLookup }],
        }).lean()
      : null
    const orderId = existingPayment?.billingToken || relatedOrderId || resource.id

    auditLog('PAYPAL_WEBHOOK', 'Info', `Received ${eventType} for order ${orderId}`, 'info')

    // 2. Handle events
    switch (eventType) {
      case 'CHECKOUT.ORDER.COMPLETED':
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // User thanh toán thành công
        if (!custom.userId) {
          auditLog('PAYPAL_WEBHOOK', 'Warn', `Missing userId in custom for ${orderId}`, 'warn')
          break
        }

        // Tính expiresAt = now + 30 ngày
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await upsertSubscriptionAndSync({
          userId: custom.userId,
          platform: 'paypal',
          externalId: orderId,
          productId: custom.planId || 'pro',
          startedAt: new Date(),
          expiresAt,
          autoRenew: false,
          metadata: {
            amount: resource.amount?.total || resource.amount?.value,
            currency: resource.amount?.currency || resource.amount?.currency_code,
            payerEmail: resource.payer?.email_address || resource.payer?.payer_info?.email,
            transactionId: resource.id,
            eventType,
          },
        })

        // Update payment record nếu có
        await PaymentModel.findOneAndUpdate(
          { billingToken: orderId },
          {
            $set: {
              status: 'success',
              completedAt: new Date(),
              paymentGateway: 'paypal',
            },
            $setOnInsert: {
              id: `pay_webhook_${randomUUID()}`,
              userId: custom.userId,
              planId: custom.planId || 'pro',
              amount: Number(resource.amount?.value || resource.amount?.total || purchaseUnit.amount?.value || 0),
              type: 'initial',
              billingToken: orderId,
              paypalCaptureId: captureId,
            },
          },
          { upsert: true },
        )

        auditLog('PAYPAL_WEBHOOK', 'Info', `Upgraded user ${custom.userId} to Pro via PayPal`, 'info')
        break
      }

      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'CHECKOUT.ORDER.CANCELLED': {
        // Refund payloads do not consistently repeat custom metadata. Resolve
        // ownership from our canonical checkout-order payment record instead.
        const payment = existingPayment || await PaymentModel.findOne({ billingToken: orderId }).lean()
        const userId = custom.userId || payment?.userId
        if (!userId) {
          auditLog('PAYPAL_WEBHOOK', 'Warn', `Cannot resolve user for canceled order ${orderId}`, 'warn')
          break
        }

        await cancelSubscriptionAndSync({
          userId,
          platform: 'paypal',
          externalId: orderId,
        })

        await PaymentModel.findOneAndUpdate(
          { billingToken: orderId },
          {
            $set: {
              status: 'failed',
              completedAt: new Date(),
            },
          },
        )

        auditLog('PAYPAL_WEBHOOK', 'Info', `Canceled PayPal subscription for user ${userId}`, 'info')
        break
      }

      default:
        auditLog('PAYPAL_WEBHOOK', 'Info', `Unhandled event ${eventType}`, 'info')
    }

    return res.status(200).json({ received: true })
  }),
)

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
        description: `MedChat247 Pro Plan Subscription (30 Days) - User: ${user.email}`,
        // Truyền userId qua custom để webhook có thể map về user khi nhận event
        custom: JSON.stringify({
          userId: user.id,
          planId: 'pro',
          source: 'web',
        }),
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

    // 🛡️ CHỐNG TÁI SỬ DỤNG MÃ ĐƠN HÀNG (Anti-Replay Attack) & XỬ LÝ ĐỒNG BỘ NẾU WEBHOOK ĐÃ NHẬN TRƯỚC
    const existingPayment = await PaymentModel.findOne({ billingToken: orderId })
    if (existingPayment) {
      if (existingPayment.status === 'success') {
        await syncUserProStatus(user.id)
        const updatedUser = await UserModel.findOne({ id: req.userId }).lean()
        return res.json({
          success: true,
          message: 'Thanh toán PayPal đã được xác nhận thành công trước đó! Gói Pro của bạn đã sẵn sàng.',
          user: toPublicUser(updatedUser),
        })
      }
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
      paypalCaptureId: captureResult.id || null,
      createdAt: new Date(),
      completedAt: new Date()
    })
    await paymentRecord.save()

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Ghi subscription record + sync plan (dùng chung với webhook)
    await upsertSubscriptionAndSync({
      userId: user.id,
      platform: 'paypal',
      externalId: orderId,
      productId: 'pro',
      startedAt: now,
      expiresAt,
      autoRenew: true,
      metadata: {
        paypalPayerId: captureResult?.payer?.payer_id || null,
        paypalEmail: captureResult?.payer?.email_address || user.email,
        capturedAt: new Date().toISOString(),
        source: 'web',
      },
    })

    const updatedUser = await UserModel.findOne({ id: req.userId }).lean()

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
