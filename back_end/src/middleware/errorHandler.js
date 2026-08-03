export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Không tìm thấy route ${req.method} ${req.path}` })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500
  if (status >= 500) {
    // Keep implementation details in server logs only.
    err.message = 'An unexpected server error occurred.'
  }
  if (status >= 500) {
    console.error(err)
  } else {
    console.warn(`[Client Error ${status}] ${err.message} - Path: ${req.method} ${req.path}`)
  }

  // Errors are only accumulated in-memory for non-production environments.
  // Production: no in-memory error log to prevent memory leaks.
  if (process.env.NODE_ENV !== 'production') {
    global.serverErrors = global.serverErrors || []
    global.serverErrors.push({
      timestamp: new Date().toISOString(),
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    })
    if (global.serverErrors.length > 50) global.serverErrors.shift()
  }

  res.status(status).json({ error: err.message || 'Đã xảy ra lỗi máy chủ.' })
}
