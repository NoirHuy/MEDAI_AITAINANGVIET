import { env } from '../../config/env.js'
import { auditLog } from '../../utils/auditLog.js'

export async function searchUMLS(queryString, retries = 2, delay = 500) {
  if (!env.umlsApiKey) {
    auditLog('UMLS', 'Info', 'No UMLS_API_KEY config. Skipping UMLS search.')
    return []
  }
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const url = `https://uts-ws.nlm.nih.gov/rest/search/current?string=${encodeURIComponent(queryString)}&apiKey=${env.umlsApiKey}`
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!response.ok) {
        throw new Error(`Dịch vụ UMLS trả về lỗi ${response.status}`)
      }
      const data = await response.json()
      return data.result?.results || []
    } catch (err) {
      const isLastAttempt = attempt === retries + 1
      if (isLastAttempt) {
        const isTimeout = err.name === 'TimeoutError' || err.message?.includes('aborted')
        throw new Error(isTimeout ? "Dịch vụ UMLS không phản hồi (Timeout 6s)" : `Mất kết nối UMLS: ${err.message}`)
      }
      auditLog('UMLS', 'Warning', `Yêu cầu tìm kiếm "${queryString}" thất bại ở lần thử ${attempt}: ${err.message}. Đang thử lại sau ${delay}ms...`, 'warn')
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
