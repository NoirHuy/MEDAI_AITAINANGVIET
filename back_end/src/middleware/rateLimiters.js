import rateLimit from 'express-rate-limit'

const isDev = process.env.NODE_ENV !== 'production'

// Helper tạo response lỗi chuẩn HTTP 429
const createRateLimitMessage = (msg) => ({
  error: msg,
  statusCode: 429,
})

// ─── 1. AUTH RATE LIMITERS ──────────────────────────────────────────────────

/// Chống Brute-force dò mật khẩu: Tối đa 5 lần sai / 15 phút
export const authSigninLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage(
    'Bạn đã nhập sai quá 5 lần. Để bảo vệ tài khoản, vui lòng thử lại sau 15 phút.'
  ),
})

/// Chống Spam tạo tài khoản rác: Tối đa 3 lần đăng ký / 1 giờ
export const authSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 100 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage(
    'Số lần đăng ký tài khoản từ thiết bị này đã đạt giới hạn. Vui lòng quay lại sau 1 giờ.'
  ),
})

/// Đăng nhập Google OAuth: Tối đa 10 lần / 15 phút
export const authGoogleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage(
    'Thao tác đăng nhập Google quá tần suất. Vui lòng thử lại sau ít phút.'
  ),
})

/// Lấy cấu hình & Signout: Tối đa 30 lần / 1 phút
export const authGeneralLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Tần suất truy cập quá nhanh. Vui lòng thử lại sau.'),
})

// ─── 2. CHAT & AI LLM RATE LIMITERS ────────────────────────────────────────

/// Hỏi đáp Y tế AI (LLM Stream): Khách vãng lai 10 lượt/15phút, Thành viên 30 lượt/15phút
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : (req) => (req.userId ? 30 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage(
    'Bạn đã đặt quá nhiều câu hỏi trong thời gian ngắn. Vui lòng nghỉ ngơi vài phút trước khi tiếp tục tư vấn.'
  ),
})

/// Tạo tiêu đề tự động: Tối đa 20 lần / 15 phút
export const chatTitleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Tần suất tạo tiêu đề tự động quá nhanh.'),
})

/// Lấy / Tạo / Xóa danh sách hội thoại: Tối đa 60 lần / 1 phút
export const chatGeneralLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isDev ? 300 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Thao tác hội thoại quá tần suất. Vui lòng thử lại.'),
})

// ─── 3. ACCOUNT & PROFILE RATE LIMITERS ─────────────────────────────────────

/// Đổi mật khẩu: Tối đa 5 lần / 15 phút
export const accountPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Số lần đổi mật khẩu vượt quá quy định. Vui lòng thử lại sau 15 phút.'),
})

/// Cập nhật hồ sơ & Thẻ thanh toán: Tối đa 15 lần / 15 phút
export const accountGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 150 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Thao tác cập nhật tài khoản quá nhanh. Vui lòng chờ ít phút.'),
})

// ─── 4. MEMORIES RATE LIMITERS ─────────────────────────────────────────────

/// Quản lý ký ức y tế: Tối đa 60 lần / 1 phút
export const memoriesLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isDev ? 300 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Thao tác cập nhật ký ức y tế quá nhanh.'),
})

// ─── 5. PAYMENT RATE LIMITERS ──────────────────────────────────────────────

/// Tạo & xác nhận đơn hàng PayPal: Tối đa 5 lần / 15 phút
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage(
    'Khởi tạo đơn hàng thanh toán quá nhiều lần. Vui lòng thử lại sau 15 phút.'
  ),
})

// ─── 6. ADMIN DASHBOARD RATE LIMITERS ──────────────────────────────────────

/// Bảng điều khiển Quản trị Admin: Tối đa 100 lần / 1 phút
export const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isDev ? 500 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage('Tần suất truy cập trang quản trị vượt quá giới hạn an toàn.'),
})
