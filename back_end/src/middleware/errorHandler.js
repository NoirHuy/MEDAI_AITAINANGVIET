export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Không tìm thấy route ${req.method} ${req.path}` })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(err)

  global.serverErrors = global.serverErrors || []
  global.serverErrors.push({
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  })
  if (global.serverErrors.length > 50) global.serverErrors.shift()

  const status = err.status ?? 500
  res.status(status).json({ error: err.message || 'Đã xảy ra lỗi máy chủ.' })
}
