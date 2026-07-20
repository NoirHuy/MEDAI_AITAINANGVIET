import { useEffect, useState } from 'react'
import { CloseIcon, UserCircleIcon, GaugeIcon, CreditCardIcon, CheckIcon, HelpCircleIcon } from './Icons'
import { PLANS, getPlan } from '../data/account'
import './SettingsModal.css'

const TABS = [
  { id: 'account', label: 'Tài khoản', Icon: UserCircleIcon },
  { id: 'usage', label: 'Mức sử dụng', Icon: GaugeIcon },
  { id: 'subscription', label: 'Gói thuê bao', Icon: CreditCardIcon },
  { id: 'help', label: 'Trợ giúp & Phản hồi', Icon: HelpCircleIcon },
]

export default function SettingsModal({
  activeTab,
  onClose,
  onChangeTab,
  account,
  onUpdateName,
  onSetPlan,
  onSignOut,
  onFetchUsage,
}) {
  const [nameDraft, setNameDraft] = useState(account.name)
  const [usage, setUsage] = useState(null)
  const [usageError, setUsageError] = useState(null)

  useEffect(() => {
    setNameDraft(account.name)
  }, [account.name])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (activeTab !== 'usage') return
    let cancelled = false
    setUsageError(null)
    onFetchUsage()
      .then((data) => {
        if (!cancelled) setUsage(data)
      })
      .catch((err) => {
        if (!cancelled) setUsageError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, onFetchUsage])

  if (!activeTab) return null

  const plan = getPlan(account.planId)
  const usagePercent = usage
    ? Math.min(100, Math.round((usage.tokensUsed / usage.tokenLimit) * 100))
    : 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="settings-modal__close" onClick={onClose} aria-label="Đóng">
          <CloseIcon />
        </button>

        <nav className="settings-modal__tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`settings-modal__tab ${id === activeTab ? 'settings-modal__tab--active' : ''}`}
              onClick={() => onChangeTab(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-modal__content">
          {activeTab === 'account' && (
            <section>
              <h2>Hồ sơ tài khoản</h2>
              <p className="settings-modal__hint">
                Thông tin tài khoản được lưu trên máy chủ backend (cơ sở dữ liệu JSON dùng cho môi
                trường phát triển).
              </p>
              <label className="settings-field">
                <span>Tên hiển thị</span>
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
              </label>
              <label className="settings-field">
                <span>Email</span>
                <input value={account.email} disabled />
              </label>
              <div className="settings-modal__actions">
                <button className="btn btn--primary" onClick={() => onUpdateName(nameDraft)}>
                  Lưu thay đổi
                </button>
                <button className="btn btn--danger-outline" onClick={onSignOut}>
                  Đăng xuất
                </button>
              </div>
            </section>
          )}

          {activeTab === 'usage' && (
            <section>
              <h2>Mức sử dụng &amp; Token</h2>
              <p className="settings-modal__hint">
                Số liệu do máy chủ backend ghi nhận sau mỗi lần bạn nhắn tin (ước tính ~4 ký
                tự/token). Tổng token sẽ tiếp tục cộng dồn cho đến khi có tính năng làm mới theo
                chu kỳ hàng tháng.
              </p>
              {usageError && <p className="auth-modal__error">{usageError}</p>}
              {!usage && !usageError && <p className="settings-modal__hint">Đang tải...</p>}
              {usage && (
                <div className="usage-card">
                  <div className="usage-card__row">
                    <span>Gói hiện tại</span>
                    <strong>{plan.name}</strong>
                  </div>
                  <div className="usage-card__row">
                    <span>Đã dùng</span>
                    <strong>
                      {usage.tokensUsed.toLocaleString('vi-VN')} /{' '}
                      {usage.tokenLimit.toLocaleString('vi-VN')} token
                    </strong>
                  </div>
                  <div className="usage-bar">
                    <div className="usage-bar__fill" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <p className="usage-card__note">{usagePercent}% hạn mức đã sử dụng.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === 'subscription' && (
            <section>
              <h2>Gói thuê bao</h2>
              <div className="plans-grid">
                {PLANS.map((p) => {
                  const isCurrent = p.id === account.planId
                  return (
                    <div key={p.id} className={`plan-card ${isCurrent ? 'plan-card--current' : ''}`}>
                      {isCurrent && <span className="plan-card__badge">Đang sử dụng</span>}
                      <h3>{p.name}</h3>
                      <p className="plan-card__price">
                        {p.price}
                        <span>{p.priceDetail}</span>
                      </p>
                      <ul>
                        {p.features.map((f) => (
                          <li key={f}>
                            <CheckIcon /> {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        className={`btn ${isCurrent ? 'btn--outline' : 'btn--primary'}`}
                        disabled={isCurrent}
                        onClick={() => onSetPlan(p.id)}
                      >
                        {isCurrent ? 'Gói hiện tại' : `Chuyển sang ${p.name}`}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="settings-modal__hint">
                Đây là giả lập nâng cấp/hạ cấp gói, chưa kết nối cổng thanh toán thật (ví dụ
                Stripe, VNPay, Momo).
              </p>
            </section>
          )}
          {activeTab === 'help' && (
            <section className="help-section">
              <h2>Trợ giúp &amp; Phản hồi</h2>
              <p className="settings-modal__hint">
                Gặp khó khăn khi sử dụng hoặc muốn đóng góp ý kiến nâng cấp hệ thống? Bạn có thể gửi phản hồi trực tiếp cho đội ngũ phát triển MedAI tại đây.
              </p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const feedback = e.target.elements.feedback.value;
                if (!feedback.trim()) return;
                alert('Cảm ơn bạn đã gửi phản hồi! Đội ngũ phát triển MedAI sẽ phản hồi lại bạn sớm nhất.');
                e.target.reset();
              }} className="feedback-form" style={{ marginTop: '16px' }}>
                <label className="settings-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Nội dung phản hồi / Yêu cầu hỗ trợ</span>
                  <textarea 
                    name="feedback" 
                    placeholder="Mô tả chi tiết câu hỏi hoặc lỗi bạn gặp phải..." 
                    rows={4}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface-hover)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      resize: 'none'
                    }}
                  />
                </label>
                <div style={{ marginTop: '14px' }}>
                  <button type="submit" className="btn btn--primary">
                    Gửi phản hồi
                  </button>
                </div>
              </form>

              <div className="faq-box" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>Câu hỏi thường gặp (FAQ)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>1. MedAI chẩn đoán có chính xác không?</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>Hệ thống chỉ mang tính chất sàng lọc và tư vấn ban đầu dựa trên đồ thị tri thức lâm sàng SymCAT. Kết quả không thay thế chẩn đoán của bác sĩ chuyên khoa.</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>2. Tại sao số lượng câu hỏi lại thay đổi giữa các lượt?</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>Hệ thống tự động phân tích độ phủ và tầm quan trọng của các triệu chứng phân biệt còn lại để đưa ra từ 3 đến 5 câu hỏi tối ưu nhất.</span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
