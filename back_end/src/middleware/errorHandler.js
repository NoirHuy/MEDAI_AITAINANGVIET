export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Không tìm thấy route ${req.method} ${req.path}` })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(err)
  const status = err.status ?? 500
  res.status(status).json({ error: err.message || 'Đã xảy ra lỗi máy chủ.' })
}
