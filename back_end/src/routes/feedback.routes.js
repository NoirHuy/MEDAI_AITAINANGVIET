import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { FeedbackModel } from '../db/feedback.model.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ─── USER ROUTES ────────────────────────────────────────────────────────────

// POST /api/feedback — Gửi góp ý (yêu cầu đăng nhập)
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { content, category, priority, isAnonymous } = req.body ?? {}

    if (!content?.trim()) {
      throw new HttpError(400, 'Nội dung phản hồi không được để trống.')
    }
    if (content.trim().length > 2000) {
      throw new HttpError(400, 'Nội dung phản hồi không được vượt quá 2000 ký tự.')
    }
    if (!category || !['bug', 'feature', 'question', 'complaint', 'other', 'help'].includes(category)) {
      throw new HttpError(400, 'Loại phản hồi không hợp lệ.')
    }

    // Lấy thông tin user từ DB
    const { UserModel } = await import('../db/user.model.js')
    const user = await UserModel.findOne({ id: req.userId }).lean()
    if (!user) {
      throw new HttpError(404, 'Không tìm thấy tài khoản.')
    }

    const doAnonymous = isAnonymous === true
    const feedback = new FeedbackModel({
      id: `fb_${Date.now()}_${randomUUID().slice(0, 8)}`,
      userId: req.userId,
      userName: doAnonymous ? 'Khách ẩn danh' : (user.name || user.email || 'Người dùng'),
      userEmail: doAnonymous ? null : (user.email || null),
      content: content.trim(),
      category,
      isAnonymous: doAnonymous,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: 'new',
      metadata: {
        ip: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('User-Agent') || null,
      },
    })

    await feedback.save()

    return res.status(201).json({
      success: true,
      message: 'Gửi phản hồi thành công! Cảm ơn bạn đã đóng góp ý kiến.',
      feedback: {
        id: feedback.id,
        category: feedback.category,
        status: feedback.status,
        createdAt: feedback.createdAt,
        adminReply: feedback.adminReply,
        repliedAt: feedback.repliedAt,
      },
    })
  }),
)

// GET /api/feedback/me — Lịch sử góp ý của user (yêu cầu đăng nhập)
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const [feedbacks, total] = await Promise.all([
      FeedbackModel.find({ userId: req.userId })
        .select('id category priority status adminReply repliedAt replierName createdAt content')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FeedbackModel.countDocuments({ userId: req.userId }),
    ])

    return res.json({
      feedbacks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  }),
)

export default router
