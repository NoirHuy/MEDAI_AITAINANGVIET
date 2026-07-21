import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { UserModel } from '../db/user.model.js'
import { PaymentModel } from '../db/payment.model.js'
import { toPublicUser, updateUser } from '../db/usersRepo.js'

const router = Router()

// Yêu cầu đăng nhập và có quyền Admin
router.use(requireAuth, requireAdmin)

// ─── 1. THỐNG KÊ HỆ THỐNG TOÀN CỤC ──────────────────────────────────────────
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    // A. Tổng số người dùng
    const totalUsers = await UserModel.countDocuments()

    // B. Tổng số token sử dụng của toàn bộ hệ thống
    const tokenAggregate = await UserModel.aggregate([
      { $group: { _id: null, total: { $sum: '$tokensUsed' } } }
    ])
    const totalTokensUsed = tokenAggregate[0]?.total || 0

    // C. Tổng doanh thu (Các hóa đơn thanh toán thành công)
    const revenueAggregate = await PaymentModel.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    const totalRevenue = revenueAggregate[0]?.total || 0

    // D. Phân bổ gói cước
    const freeUsers = await UserModel.countDocuments({ planId: 'free' })
    const proUsers = await UserModel.countDocuments({ planId: 'pro' })

    res.json({
      stats: {
        totalUsers,
        totalTokensUsed,
        totalRevenue,
        planDistribution: {
          free: freeUsers,
          pro: proUsers
        }
      }
    })
  })
)

// ─── 2. DANH SÁCH THÀNH VIÊN (PHÂN TRANG & TÌM KIẾM) ─────────────────────────
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.max(1, Number(req.query.limit) || 10)
    const search = (req.query.search || '').trim()

    const filter = {}
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }

    const skip = (page - 1) * limit
    const total = await UserModel.countDocuments(filter)
    const users = await UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      users: users.map(toPublicUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  })
)

// ─── 3. CẬP NHẬT THÀNH VIÊN (PLAN, ROLE, RESET TOKENS) ──────────────────────
router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { planId, role, resetTokens } = req.body ?? {}

    const user = await UserModel.findOne({ id })
    if (!user) throw new HttpError(404, 'Không tìm thấy người dùng.')

    const patch = {}
    if (planId !== undefined) {
      if (planId !== 'free' && planId !== 'pro') {
        throw new HttpError(400, 'Gói cước không hợp lệ.')
      }
      patch.planId = planId
      // Nếu đổi gói cước, đồng thời điều chỉnh thời hạn gia hạn
      if (planId === 'pro' && !user.subscriptionExpiresAt) {
        patch.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        patch.subscriptionStatus = 'active'
      } else if (planId === 'free') {
        patch.subscriptionExpiresAt = null
        patch.subscriptionStatus = 'none'
        patch.autoRenew = false
      }
    }

    if (role !== undefined) {
      if (role !== 'user' && role !== 'admin') {
        throw new HttpError(400, 'Quyền hạn không hợp lệ.')
      }
      patch.role = role
    }

    if (resetTokens === true) {
      patch.tokensUsed = 0
    }

    const updated = await UserModel.findOneAndUpdate(
      { id },
      { $set: patch },
      { new: true }
    ).lean()

    res.json({ success: true, user: toPublicUser(updated) })
  })
)

// ─── 4. XÓA TÀI KHOẢN NGƯỜI DÙNG ───────────────────────────────────────────
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params
    if (id === req.userId) {
      throw new HttpError(400, 'Bạn không thể tự xóa tài khoản của chính mình.')
    }
    const result = await UserModel.deleteOne({ id })
    if (result.deletedCount === 0) {
      throw new HttpError(404, 'Không tìm thấy người dùng.')
    }
    res.json({ success: true })
  })
)

// ─── 5. LẤY TOÀN BỘ GIAO DỊCH HỆ THỐNG ────────────────────────────────────
router.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const payments = await PaymentModel.find({}).sort({ createdAt: -1 }).lean()
    
    // Nạp thêm thông tin email người dùng cho mỗi giao dịch để dễ quản trị
    const userIds = [...new Set(payments.map(p => p.userId))]
    const users = await UserModel.find({ id: { $in: userIds } }, 'id email name').lean()
    const userMap = new Map(users.map(u => [u.id, u]))

    const enriched = payments.map(p => ({
      ...p,
      user: userMap.get(p.userId) || { name: 'Đã xóa', email: 'N/A' }
    }))

    res.json({ payments: enriched })
  })
)

export default router
