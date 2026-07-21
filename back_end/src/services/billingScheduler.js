import Stripe from 'stripe'
import cron from 'node-cron'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { UserModel } from '../db/user.model.js'
import { PaymentModel } from '../db/payment.model.js'

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null

// Hàm thực hiện gia hạn tự động cho 1 người dùng cụ thể
export async function autoRenewSubscriptionForUser(user) {
  if (!user.autoRenew || !user.billingToken) return null

  const amount = 99000 // Gói Pro cố định 99.000đ/tháng
  const paymentId = randomUUID()

  // 1. Tạo bản ghi giao dịch ở trạng thái pending
  const payment = new PaymentModel({
    id: paymentId,
    userId: user.id,
    planId: 'pro',
    amount,
    status: 'pending',
    type: 'recurring',
    paymentGateway: user.billingMethod
  })
  await payment.save()

  try {
    let success = false

    if (user.billingMethod === 'stripe' && stripe) {
      console.log(`[Billing Scheduler] Gọi Stripe API gia hạn tự động cho khách hàng ${user.billingToken}...`)
      // Gọi Stripe API trừ tiền off-session
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'vnd',
        customer: user.billingToken,
        payment_method: user.billingDetails?.paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Gia hạn tự động gói Pro MedChat - User ID: ${user.id}`
      })
      if (paymentIntent.status === 'succeeded') {
        success = true
      }
    } else {
      // Giả lập thanh toán (Cho cả Momo hoặc Thẻ khi không cấu hình khóa Stripe)
      console.log(`[Billing Scheduler] Giả lập gia hạn tự động qua ${user.billingMethod} cho User ${user.id}...`)
      await new Promise(resolve => setTimeout(resolve, 1500)) // Giả lập độ trễ kết nối API

      // Mô phỏng thất bại cho số điện thoại/thẻ test nhất định nếu muốn kiểm thử lỗi
      const isFailedTest = user.billingDetails?.momoPhone === '0900000000' || user.billingDetails?.last4 === '0000'
      if (!isFailedTest) {
        success = true
      }
    }

    if (success) {
      console.log(`[Billing Scheduler] Gia hạn THÀNH CÔNG cho User ID: ${user.id}`)
      
      // Cập nhật ngày hết hạn thêm 30 ngày từ ngày hết hạn cũ (hoặc từ hiện tại nếu đã quá hạn)
      const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : new Date()
      const nextExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000)

      await UserModel.updateOne(
        { id: user.id },
        { 
          $set: { 
            subscriptionExpiresAt: nextExpiry,
            subscriptionStatus: 'active',
            planId: 'pro'
          }
        }
      )

      await PaymentModel.updateOne(
        { id: paymentId },
        { 
          $set: { 
            status: 'success',
            completedAt: new Date()
          }
        }
      )
      return { success: true }
    } else {
      throw new Error('Giao dịch bị từ chối bởi nhà cung cấp nguồn tiền.')
    }

  } catch (err) {
    console.error(`[Billing Scheduler][Error] Gia hạn tự động THẤT BẠI cho User ID: ${user.id}:`, err.message)
    
    // Cập nhật người dùng về gói Free do không trừ được tiền
    await UserModel.updateOne(
      { id: user.id },
      { 
        $set: { 
          subscriptionStatus: 'past_due',
          autoRenew: false, // Tắt tự động gia hạn để tránh vòng lặp lỗi
          planId: 'free'
        }
      }
    )

    await PaymentModel.updateOne(
      { id: paymentId },
      { 
        $set: { 
          status: 'failed',
          completedAt: new Date()
        }
      }
    )
    return { success: false, error: err.message }
  }
}

// Bắt đầu lập lịch tiến trình quét gia hạn tự động hàng ngày
export function startBillingScheduler() {
  // Lịch chạy: 1 giờ sáng mỗi đêm
  cron.schedule('0 1 * * *', async () => {
    console.log('[Billing Scheduler] Bắt đầu quét hóa đơn đăng ký tự động gia hạn...')
    try {
      const now = new Date()
      // Tìm các tài khoản đã hoặc sắp hết hạn gói Pro và có bật auto-renew
      const expiredUsers = await UserModel.find({
        planId: 'pro',
        autoRenew: true,
        subscriptionExpiresAt: { $lte: now }
      })

      console.log(`[Billing Scheduler] Tìm thấy ${expiredUsers.length} tài khoản cần gia hạn tự động.`)
      for (const user of expiredUsers) {
        await autoRenewSubscriptionForUser(user)
      }
    } catch (err) {
      console.error('[Billing Scheduler][Error] Lỗi tiến trình lập lịch:', err.message)
    }
  })
  console.log('[Billing Scheduler] Cron Job gia hạn tự động đã được kích hoạt thành công (Chạy lúc 01:00 AM hàng ngày).')
}
