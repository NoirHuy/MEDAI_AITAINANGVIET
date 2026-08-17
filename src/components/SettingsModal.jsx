import { useEffect, useState } from 'react'
import { CloseIcon, UserCircleIcon, GaugeIcon, CreditCardIcon, CheckIcon, HelpCircleIcon, SparklesIcon, LockIcon, TrashIcon, BrainIcon, ShieldCheckIcon, FileTextIcon } from './Icons'
import { PLANS, getPlan } from '../data/account'
import './SettingsModal.css'

const envApiUrl = import.meta.env.VITE_API_URL
const API_URL = (envApiUrl && envApiUrl !== 'http://localhost:4000')
  ? envApiUrl
  : (import.meta.env.DEV ? 'http://localhost:4000' : '')

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Yêu cầu thất bại (${res.status})`)
  return data
}

export default function SettingsModal({
  activeTab,
  onClose,
  onChangeTab,
  account,
  onUpdateName,
  onChangePassword,
  onToggleAutoRenew,
  onSetPlan,
  onUpdateAccount,
  onRefetchAccount,
  onSignOut,
  onDeleteAccount,
  onFetchUsage,
  onFetchPlans,
  showToast,
  lang = 'vi',
}) {
  const isEn = lang === 'en'

  const TABS = [
    { id: 'account', label: isEn ? 'Account' : 'Tài khoản', Icon: UserCircleIcon },
    { id: 'memory', label: isEn ? 'Personal Memory' : 'Trí nhớ cá nhân', Icon: BrainIcon },
    { id: 'usage', label: isEn ? 'Usage Stats' : 'Mức sử dụng', Icon: GaugeIcon },
    { id: 'subscription', label: isEn ? 'Subscription' : 'Gói thuê bao', Icon: SparklesIcon },
    { id: 'payment', label: isEn ? 'Payment' : 'Thanh toán', Icon: CreditCardIcon },
    { id: 'help', label: isEn ? 'Help & Support' : 'Trợ giúp & Phản hồi', Icon: HelpCircleIcon },
  ]

  const [availablePlans, setAvailablePlans] = useState(PLANS)
  const [nameDraft, setNameDraft] = useState(account?.name || '')
  const [usage, setUsage] = useState(null)
  const [usageError, setUsageError] = useState(null)

  // State cho Đổi Mật Khẩu
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // State cho Nâng Cấp Gói & Thanh Toán PayPal
  const [confirmPaymentModal, setConfirmPaymentModal] = useState(false)
  const [, setPlanLoading] = useState(false)
  const [paypalConfig, setPaypalConfig] = useState(null)
  const [paypalSdkLoaded, setPaypalSdkLoaded] = useState(false)

  // State cho Trí Nhớ Thông Minh Cá Nhân
  const [memories, setMemories] = useState([])
  const [memorySettings, setMemorySettings] = useState({
    memoryEnabled: false,
    autoRememberAllergies: true,
    autoRememberChronic: true,
    autoRememberMedications: true,
    autoRememberEpisodes: true
  })
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState('allergy')
  const [newMemorySubject, setNewMemorySubject] = useState('self')

  // State cho Góp Ý / Phản hồi
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackCategory, setFeedbackCategory] = useState('help')
  const [feedbackPriority, setFeedbackPriority] = useState('medium')
  const [feedbackAnonymous, setFeedbackAnonymous] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [myFeedbacks, setMyFeedbacks] = useState([])
  const [myFeedbacksLoading, setMyFeedbacksLoading] = useState(false)
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false)

  useEffect(() => {
    if (activeTab === 'memory' && account) {
      loadMemoryData()
    }
  }, [activeTab, account])

  async function loadMemoryData() {
    try {
      setMemoryLoading(true)
      const [memRes, setRes] = await Promise.all([
        apiRequest('/api/memories'),
        apiRequest('/api/memories/settings')
      ])
      setMemories(memRes.memories || [])
      if (setRes?.settings) {
        setMemorySettings(setRes.settings)
      }
    } catch (err) {
      console.error('[Memory] Error loading memory profile:', err)
    } finally {
      setMemoryLoading(false)
    }
  }

  async function handleToggleMemorySetting(key, val) {
    try {
      setMemorySettings((prev) => ({ ...prev, [key]: val }))
      const res = await apiRequest('/api/memories/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: val })
      })
      if (res?.settings) {
        setMemorySettings(res.settings)
      }
      showToast?.(isEn ? 'Memory settings updated.' : 'Đã cập nhật cài đặt trí nhớ.')
    } catch (err) {
      setMemorySettings((prev) => ({ ...prev, [key]: !val }))
      showToast?.(err.message || (isEn ? 'Could not save settings.' : 'Không thể lưu cài đặt.'))
    }
  }

  async function handleAddMemorySubmit(e) {
    e.preventDefault()
    if (!newMemoryContent.trim()) return
    const criticalCats = ['allergy', 'chronic_condition', 'blood_type', 'pregnancy']
    const importance = criticalCats.includes(newMemoryCategory) ? 'critical' : 'medium'
    try {
      const { memory } = await apiRequest('/api/memories', {
        method: 'POST',
        body: JSON.stringify({
          content: newMemoryContent.trim(),
          category: newMemoryCategory,
          subject: newMemorySubject,
          importance
        })
      })
      setMemories((prev) => [memory, ...prev])
      setNewMemoryContent('')
      showToast?.(isEn ? 'Added new memory entry.' : 'Đã thêm mục trí nhớ mới.')
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Could not add memory.' : 'Không thể thêm trí nhớ.'))
    }
  }

  async function handleToggleLockSingleMemory(id, currentLockStatus) {
    try {
      const nextLock = !currentLockStatus
      await apiRequest(`/api/memories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isLocked: nextLock })
      })
      setMemories((prev) => prev.map((m) => m.id === id ? { ...m, isLocked: nextLock } : m))
      showToast?.(nextLock 
        ? (isEn ? 'Memory record locked.' : 'Đã khóa ký ức (AI không được tự ý ghi đè).')
        : (isEn ? 'Memory record unlocked.' : 'Đã mở khóa ký ức.')
      )
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Could not change lock status.' : 'Không thể thay đổi trạng thái khóa.'))
    }
  }

  async function handleDeleteSingleMemory(id) {
    const confirmMsg = isEn ? 'Are you sure you want to delete this memory entry?' : 'Bạn có chắc chắn muốn xóa mục trí nhớ này khỏi hồ sơ?'
    if (!window.confirm(confirmMsg)) return
    try {
      await apiRequest(`/api/memories/${id}`, { method: 'DELETE' })
      setMemories((prev) => prev.filter((m) => m.id !== id))
      showToast?.(isEn ? 'Memory entry deleted.' : 'Đã xóa mục trí nhớ.')
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Could not delete memory entry.' : 'Không thể xóa mục trí nhớ.'))
    }
  }

  async function handleClearAllMemoriesClick() {
    const confirmMsg = isEn ? 'WARNING: This will clear your entire medical memory profile. Are you sure?' : 'CẢNH BÁO: Hành động này sẽ XÓA MỀM toàn bộ hồ sơ trí nhớ y tế của bạn. Bạn có chắc chắn không?'
    if (!window.confirm(confirmMsg)) return
    try {
      await apiRequest('/api/memories', { method: 'DELETE' })
      setMemories([])
      showToast?.(isEn ? 'All memories cleared.' : 'Đã xóa toàn bộ hồ sơ trí nhớ.')
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Could not clear memories.' : 'Không thể xóa toàn bộ.'))
    }
  }

  function handleExportMemoryProfileClick() {
    window.open('/api/memories/export', '_blank')
  }

  // ─── GÓP Ý / PHẢN HỒI ───────────────────────────────────────────────
  const isLoggedIn = !!account?.id

  async function loadMyFeedbacks() {
    setMyFeedbacksLoading(true)
    try {
      const data = await apiRequest('/api/feedback/me')
      setMyFeedbacks(data.feedbacks || [])
    } catch (err) {
      console.error('[Feedback] Load history error:', err)
    } finally {
      setMyFeedbacksLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'help' && isLoggedIn) {
      loadMyFeedbacks()
    }
  }, [activeTab, isLoggedIn])

  async function handleSubmitFeedback(e) {
    e.preventDefault()
    if (!feedbackContent.trim()) return

    setFeedbackSubmitting(true)
    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          content: feedbackContent.trim(),
          category: feedbackCategory,
          priority: feedbackPriority,
          isAnonymous: feedbackAnonymous,
        }),
      })
      showToast?.(isEn ? 'Feedback submitted successfully! Thank you.' : 'Gửi phản hồi thành công! Cảm ơn bạn đã đóng góp ý kiến.')
      setFeedbackContent('')
      setFeedbackAnonymous(false)
      setFeedbackPriority('medium')
      setShowFeedbackHistory(true)
      loadMyFeedbacks()
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Could not submit feedback.' : 'Không thể gửi phản hồi.'))
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  useEffect(() => {
    if ((activeTab === 'payment' || confirmPaymentModal) && !paypalConfig) {
      apiRequest('/api/payments/config')
        .then((cfg) => setPaypalConfig(cfg))
        .catch((err) => console.error('[PayPal Config] Error loading config:', err))
    }
  }, [activeTab, confirmPaymentModal, paypalConfig])

  // Load PayPal SDK script dynamically when PayPal config is ready
  useEffect(() => {
    if (!paypalConfig?.clientId || paypalSdkLoaded) return
    const scriptId = 'paypal-js-sdk'
    if (document.getElementById(scriptId)) {
      setPaypalSdkLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=USD`
    script.async = true
    script.onload = () => setPaypalSdkLoaded(true)
    script.onerror = () => console.error('[PayPal SDK] Failed to load SDK script.')
    document.body.appendChild(script)
  }, [paypalConfig, paypalSdkLoaded])

  // Render PayPal Smart Buttons inside container element
  useEffect(() => {
    if (!paypalSdkLoaded || !window.paypal) return

    const container = document.getElementById('paypal-button-container')
    if (!container || container.childElementCount > 0) return

    try {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
        },
        createOrder: async () => {
          setPlanLoading(true)
          try {
            const res = await apiRequest('/api/payments/paypal/create-order', { method: 'POST' })
            return res.orderId
          } catch (err) {
            showToast?.(err.message || (isEn ? 'Could not create PayPal order.' : 'Không thể tạo đơn hàng PayPal.'))
            setPlanLoading(false)
            throw err
          }
        },
        onApprove: async (data) => {
          try {
            const res = await apiRequest('/api/payments/paypal/capture-order', {
              method: 'POST',
              body: JSON.stringify({ orderId: data.orderID }),
            })
            showToast?.(res.message || (isEn ? 'PayPal payment successful!' : 'Thanh toán PayPal thành công!'))
            setConfirmPaymentModal(false)

            if (onRefetchAccount) {
              await onRefetchAccount()
            }
            if (res.user) {
              onUpdateAccount?.(res.user)
            }
          } catch (err) {
            showToast?.(err.message || (isEn ? 'Could not complete PayPal payment.' : 'Không thể hoàn tất thanh toán PayPal.'))
          } finally {
            setPlanLoading(false)
          }
        },
        onError: (err) => {
          console.error('[PayPal Error]', err)
          showToast?.(isEn ? 'An error occurred during PayPal payment.' : 'Xảy ra lỗi trong quá trình thanh toán PayPal.')
          setPlanLoading(false)
        },
      }).render('#paypal-button-container')
    } catch (e) {
      console.error('[PayPal Render Error]', e)
    }
  }, [paypalSdkLoaded, activeTab, confirmPaymentModal, showToast, onSetPlan, isEn])

  // Xử lý bấm Chuyển Gói
  function handleSelectPlanClick(targetPlanId) {
    if (targetPlanId === account.planId) return
    if (targetPlanId === 'pro') {
      setConfirmPaymentModal(true)
    } else {
      const confirmMsg = isEn ? 'Are you sure you want to switch to the Free plan?' : 'Bạn có chắc chắn muốn chuyển về gói Miễn phí?'
      if (window.confirm(confirmMsg)) {
        processPlanChange('free')
      }
    }
  }

  // Tiến hành gọi API đổi gói (dành cho gói Free)
  async function processPlanChange(planId) {
    try {
      setPlanLoading(true)
      await onSetPlan(planId)
      setConfirmPaymentModal(false)
      showToast?.(isEn ? 'Switched to Free plan.' : 'Đã chuyển về gói Miễn phí.')
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Could not change plan.' : 'Không thể thay đổi gói.'))
    } finally {
      setPlanLoading(false)
    }
  }

  useEffect(() => {
    setNameDraft(account?.name || '')
  }, [account?.name])

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

  useEffect(() => {
    let cancelled = false
    const fetchFn = onFetchPlans || (() => apiRequest('/api/account/plans'))
    fetchFn()
      .then((data) => {
        if (!cancelled && Array.isArray(data?.plans) && data.plans.length > 0) {
          setAvailablePlans(data.plans)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [onFetchPlans])

  if (!activeTab || !account) return null

  const plan = getPlan(account.planId, lang, availablePlans)
  const usagePercent = usage
    ? Math.min(100, Math.round((usage.tokensUsed / usage.tokenLimit) * 100))
    : 0

  const isGoogleAccount = account.provider === 'google'
  const isAutoRenewOn = account.autoRenew !== false

  // Xử lý đổi mật khẩu
  async function handleChangePasswordSubmit(e) {
    e.preventDefault()
    setPasswordStatus(null)

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', text: isEn ? 'New password must be at least 6 characters.' : 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: isEn ? 'Confirm password does not match.' : 'Mật khẩu xác nhận không trùng khớp.' })
      return
    }

    try {
      setPasswordLoading(true)
      await onChangePassword({ oldPassword, newPassword })
      setPasswordStatus({ type: 'success', text: isEn ? 'Password changed successfully!' : 'Đổi mật khẩu thành công!' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast?.(isEn ? 'Password changed successfully!' : 'Đổi mật khẩu thành công!')
    } catch (err) {
      setPasswordStatus({ type: 'error', text: err.message || (isEn ? 'Could not change password.' : 'Không thể đổi mật khẩu.') })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="settings-modal__close" onClick={onClose} aria-label={isEn ? "Close" : "Đóng"}>
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
          {/* TAB 1: TÀI KHOẢN (HỒ SƠ, ĐỔI MẬT KHẨU, VÀ XÓA TÀI KHOẢN Ở CUỐI TRANG) */}
          {activeTab === 'account' && (
            <section>
              <h2>{isEn ? 'Account Profile' : 'Hồ sơ tài khoản'}</h2>
              <p className="settings-modal__hint">
                {isEn 
                  ? 'Your personal profile information is securely stored on system databases.'
                  : 'Thông tin tài khoản cá nhân được lưu trữ an toàn trên cơ sở dữ liệu hệ thống.'
                }
              </p>

              {/* CARD 1: HỒ SƠ CÁ NHÂN */}
              <div className="settings-section-box">
                <label className="settings-field">
                  <span>{isEn ? 'Display Name' : 'Tên hiển thị'}</span>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Email</span>
                  <input value={account.email} disabled />
                </label>
                <div className="settings-modal__actions" style={{ marginTop: '12px' }}>
                  <button className="btn btn--primary" onClick={() => onUpdateName(nameDraft)}>
                    {isEn ? 'Save Profile Name' : 'Lưu thay đổi tên'}
                  </button>
                  <button className="btn btn--danger-outline" onClick={onSignOut}>
                    {isEn ? 'Log Out' : 'Đăng xuất'}
                  </button>
                </div>
              </div>

              <div className="settings-divider" />

              {/* CARD 2: MỤC ĐỔI MẬT KHẨU */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  <LockIcon /> {isEn ? 'Change Password' : 'Đổi mật khẩu'}
                </h3>

                {isGoogleAccount ? (
                  <div className="settings-info-badge">
                    <span>🔒</span>
                    <p>
                      {isEn 
                        ? 'Your account uses Google OAuth login, so a separate password is not set.'
                        : 'Tài khoản của bạn đăng nhập bằng Google OAuth nên không sử dụng mật khẩu riêng.'
                      }
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleChangePasswordSubmit} className="change-password-form">
                    {passwordStatus && (
                      <div className={`settings-alert settings-alert--${passwordStatus.type}`}>
                        {passwordStatus.text}
                      </div>
                    )}
                    <label className="settings-field">
                      <span>{isEn ? 'Current Password' : 'Mật khẩu hiện tại'}</span>
                      <input
                        type="password"
                        placeholder={isEn ? "Enter current password..." : "Nhập mật khẩu hiện tại..."}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                      />
                    </label>
                    <label className="settings-field">
                      <span>{isEn ? 'New Password' : 'Mật khẩu mới'}</span>
                      <input
                        type="password"
                        placeholder={isEn ? "At least 6 characters..." : "Tối thiểu 6 ký tự..."}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </label>
                    <label className="settings-field">
                      <span>{isEn ? 'Confirm New Password' : 'Xác nhận mật khẩu mới'}</span>
                      <input
                        type="password"
                        placeholder={isEn ? "Re-enter new password..." : "Nhập lại mật khẩu mới..."}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </label>
                    <div style={{ marginTop: '14px' }}>
                      <button type="submit" className="btn btn--primary" disabled={passwordLoading}>
                        {passwordLoading ? (isEn ? 'Updating...' : 'Đang cập nhật...') : (isEn ? 'Update Password' : 'Cập nhật mật khẩu')}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="settings-divider" />

              {/* CARD 3: XÓA TÀI KHOẢN (ĐÃ DỜI XUỐNG CUỐI CÙNG TRANG TÀI KHOẢN) */}
              <div className="settings-section-box settings-section-box--danger">
                <h3 className="settings-subheading">{isEn ? 'Delete Account' : 'Xóa tài khoản'}</h3>
                <p className="settings-modal__hint">
                  {isEn
                    ? 'Permanently delete your profile, conversations, memories, and feedback history. This action cannot be undone.'
                    : 'Xóa vĩnh viễn hồ sơ, hội thoại, trí nhớ cá nhân và phản hồi. Thao tác này không thể hoàn tác.'
                  }
                </p>
                <button
                  className="btn btn--danger-outline"
                  disabled={deleteLoading}
                  onClick={async () => {
                    const promptMsg = isEn 
                      ? 'Type DELETE to confirm permanent account deletion:' 
                      : 'Nhập DELETE để xác nhận xóa vĩnh viễn tài khoản và dữ liệu:'
                    const confirmed = window.prompt(promptMsg)
                    if (confirmed !== 'DELETE') return
                    setDeleteLoading(true)
                    try {
                      await onDeleteAccount?.()
                      onClose()
                      showToast?.(isEn ? 'Account and data permanently deleted.' : 'Tài khoản và dữ liệu cá nhân đã được xóa.')
                    } catch (err) {
                      showToast?.(err.message || (isEn ? 'Could not delete account.' : 'Không thể xóa tài khoản.'))
                    } finally {
                      setDeleteLoading(false)
                    }
                  }}
                >
                  <TrashIcon /> {deleteLoading ? (isEn ? 'Deleting...' : 'Đang xóa...') : (isEn ? 'Permanently Delete Account' : 'Xóa tài khoản vĩnh viễn')}
                </button>
              </div>
            </section>
          )}

          {/* TAB 2: TRÍ NHỚ THÔNG MINH CÁ NHÂN */}
          {activeTab === 'memory' && (
            <section>
              <div className="memory-tab-header">
                <div>
                  <h2>{isEn ? 'Personal Smart AI Memory' : 'Trí nhớ thông minh cá nhân'}</h2>
                  <p className="settings-modal__hint">
                    {isEn
                      ? 'System automatically remembers medical history to personalize consultations. All data encrypted with AES-256-GCM.'
                      : 'Hệ thống tự động ghi nhớ và cá nhân hóa trải nghiệm tham vấn dựa trên tiền sử y tế của bạn. Tất cả dữ liệu được mã hóa AES-256-GCM bảo mật tuyệt đối.'
                    }
                  </p>
                </div>
                <button
                  className="btn btn--outline btn--sm"
                  onClick={handleExportMemoryProfileClick}
                  title={isEn ? "Export personal medical history profile" : "Tải về tóm tắt tiền sử y tế cá nhân dạng tệp văn bản"}
                >
                  📄 {isEn ? 'Export Profile (.txt)' : 'Xuất hồ sơ (.txt)'}
                </button>
              </div>

              {/* TÙY CHỈNH TỰ ĐỘNG GHI NHỚ */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  <BrainIcon /> {isEn ? 'Automatic Memory Settings' : 'Cấu hình Tự động Ghi nhớ'}
                </h3>

                <div className="auto-renew-row">
                  <div className="auto-renew-text">
                    <strong>{isEn ? 'Enable Smart Medical Memory' : 'Bật tính năng Trí nhớ thông minh'}</strong>
                    <p className="auto-renew-hint">
                      {memorySettings?.memoryEnabled
                        ? (isEn ? 'ACTIVE. Allows AI to reference and auto-extract medical history.' : 'Đang BẬT. Cho phép AI tham khảo và tự động trích xuất tiền sử y tế của bạn.')
                        : (isEn ? 'OFF. AI will not reference or extract personal memory records.' : 'Đang TẮT. AI sẽ không tham khảo hoặc trích xuất dữ liệu trí nhớ cá nhân.')
                      }
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(memorySettings?.memoryEnabled)}
                      onChange={(e) => handleToggleMemorySetting('memoryEnabled', e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {memorySettings.memoryEnabled !== false && (
                  <div className="memory-category-toggles">
                    <span className="memory-toggles-title">{isEn ? 'Category-based auto-remember:' : 'Ghi nhớ theo từng danh mục:'}</span>
                    <div className="memory-toggles-grid">
                      <label className="memory-checkbox-item">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberAllergies !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberAllergies', e.target.checked)}
                        />
                        <span>🚨 {isEn ? 'Drug & food allergies' : 'Dị ứng thuốc & thức ăn'}</span>
                      </label>
                      <label className="memory-checkbox-item">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberChronic !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberChronic', e.target.checked)}
                        />
                        <span>🏥 {isEn ? 'Chronic conditions' : 'Bệnh nền mãn tính'}</span>
                      </label>
                      <label className="memory-checkbox-item">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberMedications !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberMedications', e.target.checked)}
                        />
                        <span>💊 {isEn ? 'Active medications' : 'Thuốc đang sử dụng'}</span>
                      </label>
                      <label className="memory-checkbox-item">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberEpisodes !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberEpisodes', e.target.checked)}
                        />
                        <span>📋 {isEn ? 'Short-term episodes (90 days)' : 'Đợt bệnh ngắn hạn (90 ngày)'}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-divider" />

              {/* FORM THÊM TRÍ NHỚ THỦ CÔNG */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  ➕ {isEn ? 'Add Manual Medical History Record' : 'Thêm tiền sử y tế thủ công'}
                </h3>

                <form onSubmit={handleAddMemorySubmit} className="memory-add-form-box">
                  <div className="memory-form-row">
                    <label className="settings-field">
                      <span>{isEn ? 'Category' : 'Danh mục'}</span>
                      <select
                        className="memory-select-input"
                        value={newMemoryCategory}
                        onChange={(e) => setNewMemoryCategory(e.target.value)}
                      >
                        <option value="allergy">🚨 {isEn ? 'Allergy' : 'Dị ứng (Allergy)'}</option>
                        <option value="chronic_condition">🏥 {isEn ? 'Chronic Condition' : 'Bệnh nền (Chronic)'}</option>
                        <option value="medication">💊 {isEn ? 'Medication' : 'Thuốc đang dùng (Medication)'}</option>
                        <option value="blood_type">🩸 {isEn ? 'Blood Type' : 'Nhóm máu (Blood Type)'}</option>
                        <option value="pregnancy">👶 {isEn ? 'Pregnancy' : 'Thai kỳ (Pregnancy)'}</option>
                        <option value="past_episode">📋 {isEn ? 'Past Episode' : 'Đợt bệnh trước (Past Episode)'}</option>
                        <option value="lifestyle">🏃 {isEn ? 'Lifestyle' : 'Lối sống (Lifestyle)'}</option>
                        <option value="display_preference">⚙️ {isEn ? 'Display Preference' : 'Hiển thị (Preference)'}</option>
                      </select>
                    </label>

                    <label className="settings-field">
                      <span>{isEn ? 'Subject' : 'Chủ thể'}</span>
                      <select
                        className="memory-select-input"
                        value={newMemorySubject}
                        onChange={(e) => setNewMemorySubject(e.target.value)}
                      >
                        <option value="self">👤 {isEn ? 'Myself' : 'Bản thân tôi'}</option>
                        <option value="family">👨‍👩‍👧 {isEn ? 'Family History' : 'Tiền sử gia đình'}</option>
                      </select>
                    </label>
                  </div>

                  <label className="settings-field">
                    <span>{isEn ? 'Medical Record Description' : 'Nội dung tiền sử y tế'}</span>
                    <input
                      type="text"
                      placeholder={isEn ? "e.g., Severe Penicillin Allergy, Type 2 Diabetes..." : "Nhập thông tin (ví dụ: Dị ứng Penicillin nặng, Đái tháo đường Tuýp 2...)"}
                      value={newMemoryContent}
                      onChange={(e) => setNewMemoryContent(e.target.value)}
                      required
                    />
                  </label>

                  <div className="memory-form-actions">
                    <button type="submit" className="btn btn--primary btn--sm" disabled={!newMemoryContent.trim()}>
                      {isEn ? 'Add to Memory' : 'Thêm vào hồ sơ'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="settings-divider" />

              {/* DANH SÁCH MỤC TRÍ NHỚ ĐÃ LƯU */}
              <div className="settings-section-box">
                <div className="memory-list-header">
                  <h3 className="settings-subheading" style={{ margin: 0 }}>
                    <BrainIcon /> {isEn ? `Personal Memory Profile (${memories.length} entries)` : `Hồ sơ Trí nhớ cá nhân (${memories.length} mục)`}
                  </h3>
                  {memories.length > 0 && (
                    <button
                      className="btn btn--danger-outline btn--sm"
                      onClick={handleClearAllMemoriesClick}
                    >
                      <TrashIcon /> {isEn ? 'Clear All' : 'Xóa toàn bộ'}
                    </button>
                  )}
                </div>

                {memoryLoading ? (
                  <p className="settings-modal__hint text-center" style={{ padding: '16px 0' }}>
                    {isEn ? 'Loading encrypted memory profile...' : 'Đang tải dữ liệu trí nhớ mã hóa...'}
                  </p>
                ) : memories.length === 0 ? (
                  <div className="empty-memory-state">
                    <p className="empty-title">{isEn ? 'No medical memory entries stored yet.' : 'Chưa có thông tin trí nhớ y tế nào được lưu.'}</p>
                    <p className="empty-desc">{isEn ? 'As you chat with MedChat247 or enter data above, important medical history will appear here.' : 'Khi bạn trò chuyện với MedChat247 hoặc nhập ở trên, các thông tin y tế quan trọng sẽ tự động xuất hiện tại đây.'}</p>
                  </div>
                ) : (
                  <div className="memory-cards-container">
                    {memories.map((mem) => (
                      <div className={`memory-item-card ${mem.isLocked ? 'memory-item-card--locked' : ''}`} key={mem.id}>
                        <div className="memory-item-top">
                          <div className="memory-tags-group">
                            <span className={`status-pill status-pill--${mem.category === 'allergy' ? 'free' : 'active'}`}>
                              {mem.category === 'allergy' && (isEn ? '🚨 Allergy' : '🚨 Dị ứng')}
                              {mem.category === 'chronic_condition' && (isEn ? '🏥 Chronic' : '🏥 Bệnh nền')}
                              {mem.category === 'medication' && (isEn ? '💊 Medication' : '💊 Thuốc dùng')}
                              {mem.category === 'blood_type' && (isEn ? '🩸 Blood Type' : '🩸 Nhóm máu')}
                              {mem.category === 'pregnancy' && (isEn ? '👶 Pregnancy' : '👶 Thai kỳ')}
                              {mem.category === 'past_episode' && (isEn ? '📋 Episode' : '📋 Đợt bệnh')}
                              {mem.category === 'lifestyle' && (isEn ? '🏃 Lifestyle' : '🏃 Lối sống')}
                              {mem.category === 'display_preference' && (isEn ? '⚙️ Display' : '⚙️ Hiển thị')}
                            </span>
                            <span className="memory-subject-tag">
                              {mem.subject === 'family' ? (isEn ? '👨‍👩‍👧 Family' : '👨‍👩‍👧 Gia đình') : (isEn ? '👤 Self' : '👤 Bản thân')}
                            </span>
                            {mem.isLocked && (
                              <span className="memory-locked-tag">🔒 {isEn ? 'Locked' : 'Khóa thủ công'}</span>
                            )}
                          </div>
                          <span className="memory-source-meta">
                            {mem.source === 'manual' ? (isEn ? 'Manual' : 'Thủ công') : (isEn ? 'AI Extracted' : 'AI Trích xuất')} (v{mem.version || 1})
                          </span>
                        </div>

                        <p className="memory-item-content">{mem.content}</p>

                        <div className="memory-item-bottom">
                          <span className="memory-item-date">
                            {isEn ? 'Updated: ' : 'Cập nhật: '}{new Date(mem.updatedAt || mem.createdAt).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                          </span>
                          <div className="memory-item-actions">
                            <button
                              className={`btn-icon-action ${mem.isLocked ? 'btn-icon-action--active' : ''}`}
                              onClick={() => handleToggleLockSingleMemory(mem.id, mem.isLocked)}
                              title={mem.isLocked ? (isEn ? 'Unlock (Allow AI updates)' : 'Mở khóa (Cho phép AI cập nhật)') : (isEn ? 'Lock (Prevent AI overwrite)' : 'Khóa (Khống chế không cho AI ghi đè)')}
                            >
                              <LockIcon />
                            </button>
                            <button
                              className="btn-icon-action btn-icon-action--danger"
                              onClick={() => handleDeleteSingleMemory(mem.id)}
                              title={isEn ? "Delete entry" : "Xóa mục trí nhớ này"}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* HỘP CẢNH BÁO PHÁP LÝ */}
              <div className="settings-info-badge" style={{ marginTop: '16px', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                <span>⚠️</span>
                <p>
                  <strong>{isEn ? 'Medical Disclaimer:' : 'Khuyến cáo pháp lý Y tế:'}</strong> {isEn 
                    ? 'Information stored in Personal Memory is used solely to personalize medical reference suggestions, does not constitute an official medical record, and does not replace clinical physician diagnosis.'
                    : 'Thông tin trong Trí nhớ cá nhân được sử dụng nhằm mục đích cá nhân hóa các gợi ý tham khảo y tế, không phải là Hồ sơ bệnh án y tế chính thức và không thay thế chẩn đoán lâm sàng của bác sĩ chuyên khoa.'
                  }
                </p>
              </div>
            </section>
          )}

          {/* TAB 3: MỨC SỬ DỤNG */}
          {activeTab === 'usage' && (
            <section>
              <h2>{isEn ? 'Usage & Token Limit' : 'Mức sử dụng & Token'}</h2>
              <p className="settings-modal__hint">
                {isEn
                  ? 'Recorded token usage per conversation (~4 chars/token). Accumulated towards your monthly limit.'
                  : 'Số liệu do máy chủ backend ghi nhận sau mỗi lần bạn nhắn tin (ước tính ~4 ký tự/token).'
                }
              </p>
              {usageError && <p className="auth-modal__error">{usageError}</p>}
              {!usage && !usageError && <p className="settings-modal__hint">{isEn ? 'Loading...' : 'Đang tải...'}</p>}
              {usage && (
                <div className="usage-card">
                  <div className="usage-card__row">
                    <span>{isEn ? 'Current Plan' : 'Gói hiện tại'}</span>
                    <strong>{plan.name}</strong>
                  </div>
                  <div className="usage-card__row">
                    <span>{isEn ? 'Tokens Used' : 'Đã dùng'}</span>
                    <strong>
                      {usage.tokensUsed.toLocaleString(isEn ? 'en-US' : 'vi-VN')} /{' '}
                      {usage.tokenLimit.toLocaleString(isEn ? 'en-US' : 'vi-VN')} tokens
                    </strong>
                  </div>
                  <div className="usage-bar">
                    <div className="usage-bar__fill" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <p className="usage-card__note">{usagePercent}% {isEn ? 'limit used.' : 'hạn mức đã sử dụng.'}</p>
                </div>
              )}
            </section>
          )}

          {/* TAB 4: GÓI THUÊ BAO */}
          {activeTab === 'subscription' && (
            <section>
              <h2>{isEn ? 'Subscription Plans' : 'Gói thuê bao'}</h2>
              <div className="plans-grid">
                {availablePlans.map((pRaw) => {
                  const p = getPlan(pRaw.id, lang, availablePlans)
                  const isCurrent = p.id === account.planId
                  return (
                    <div key={p.id} className={`plan-card ${isCurrent ? 'plan-card--current' : ''}`}>
                      {isCurrent && <span className="plan-card__badge">{isEn ? 'Active Plan' : 'Đang sử dụng'}</span>}
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
                        className={`btn ${isCurrent ? 'btn--outline' : (p.id === 'free' && account.planId === 'pro' ? 'btn--outline' : 'btn--primary')}`}
                        disabled={isCurrent || (p.id === 'free' && account.planId === 'pro')}
                        onClick={() => handleSelectPlanClick(p.id)}
                      >
                        {isCurrent ? (isEn ? 'Active Plan' : 'Gói hiện tại') : (p.id === 'free' && account.planId === 'pro' ? (isEn ? 'Basic Plan' : 'Gói cơ bản') : (isEn ? `Upgrade to ${p.name}` : `Chuyển sang ${p.name}`))}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="settings-modal__hint">
                {isEn ? 'Flexible plan switching between Free and Pro Medical AI.' : 'Chuyển đổi gói trải nghiệm linh hoạt giữa gói Miễn phí và Pro y tế cao cấp.'}
              </p>
            </section>
          )}

          {/* TAB 5: THANH TOÁN (PAYPAL CHECKOUT) */}
          {activeTab === 'payment' && (
            <section>
              <h2>{isEn ? 'Payment & PayPal Checkout' : 'Thanh toán & Cổng PayPal'}</h2>
              <p className="settings-modal__hint">
                {isEn ? 'Secure international payment via PayPal Checkout to upgrade to Pro (99,000đ ≈ $3.99 USD / 30 days).' : 'Thanh toán an toàn quốc tế qua PayPal Checkout để nâng cấp gói Pro Chuyên Gia (99.000đ ≈ $3.99 USD / 30 ngày).'}
              </p>

              {/* THÔNG TIN HẠN SỬ DỤNG GÓI */}
              <div className="subscription-status-box">
                <div className="status-header">
                  <div>
                    <span className="status-label">{isEn ? 'Subscription Status' : 'Trạng thái gói dịch vụ'}</span>
                    <h3 className="status-title">
                      {account.planId === 'pro' ? (isEn ? 'Pro Specialist (Active)' : 'Gói Pro Chuyên Gia (Active)') : (isEn ? 'Free Plan' : 'Gói Miễn Phí (Free)')}
                    </h3>
                  </div>
                  <span className={`status-pill status-pill--${account.planId === 'pro' ? 'active' : 'free'}`}>
                    {account.planId === 'pro' ? (isEn ? 'Active' : 'Đang hoạt động') : (isEn ? 'Free' : 'Miễn phí')}
                  </span>
                </div>

                {account.planId === 'pro' && (
                  <div className="date-info-grid">
                    <div className="date-item">
                      <span>{isEn ? 'Payment Method' : 'Phương thức thanh toán'}</span>
                      <strong>PayPal ({account.billingDetails?.paypalEmail || (isEn ? 'PayPal Account' : 'Tài khoản PayPal')})</strong>
                    </div>
                    <div className="date-item">
                      <span>{isEn ? 'Expiration Date' : 'Ngày hết hạn'}</span>
                      <strong>{account.subscriptionExpiresAt ? new Date(account.subscriptionExpiresAt).toLocaleDateString(isEn ? 'en-US' : 'vi-VN') : (isEn ? '30 days from payment' : '30 ngày kể từ ngày thanh toán')}</strong>
                    </div>
                  </div>
                )}

                {/* CÔNG TẮC GIA HẠN TỰ ĐỘNG */}
                <div className="auto-renew-row">
                  <div className="auto-renew-text">
                    <strong>{isEn ? 'Auto-Renewal Reminders' : 'Tự động nhắc gia hạn'}</strong>
                    <p className="auto-renew-hint">
                      {isAutoRenewOn
                        ? (isEn ? 'ACTIVE. System will remind you before your Pro plan expires.' : 'Đang BẬT. Hệ thống sẽ nhắc bạn gia hạn gói Pro khi sắp hết hạn.')
                        : (isEn ? 'OFF. Pro plan will automatically revert to Free upon expiration.' : 'Đang TẮT. Gói Pro sẽ tự động chuyển về Miễn phí sau ngày hết hạn.')
                      }
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isAutoRenewOn}
                      onChange={(e) => onToggleAutoRenew?.(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              <div className="settings-divider" />

              {/* MỤC NÂNG CẤP QUA PAYPAL CHECKOUT */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  <CreditCardIcon /> {isEn ? 'Upgrade Pro via PayPal (99,000đ / $3.99 USD)' : 'Nâng cấp gói Pro bằng PayPal (99.000đ / $3.99 USD)'}
                </h3>

                {account.planId === 'pro' ? (
                  <div className="settings-alert settings-alert--success" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckIcon />
                    <div>
                      <strong>{isEn ? 'Your account is on the Pro Plan!' : 'Tài khoản đang ở gói Pro Chuyên Gia!'}</strong>
                      <p style={{ margin: 0, fontSize: '12px' }}>{isEn ? 'You can renew for another 30 days at any time.' : 'Bạn có thể thanh toán thêm lượt để gia hạn 30 ngày tiếp theo bất kỳ lúc nào.'}</p>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: '16px' }}>
                  {!paypalSdkLoaded && (
                    <p className="settings-modal__hint" style={{ textAlign: 'center', padding: '12px' }}>
                      {isEn ? 'Loading secure PayPal checkout gateway...' : 'Đang tải cổng thanh toán bảo mật PayPal...'}
                    </p>
                  )}
                  <div id="paypal-button-container" style={{ maxWidth: '400px', margin: '0 auto', minHeight: '120px' }} />
                  <p className="settings-modal__hint" style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px' }}>
                    💡 <strong>{isEn ? 'Credit Card Tip (Visa/Mastercard):' : 'Mẹo khi thanh toán Thẻ (Visa/Mastercard):'}</strong> {isEn ? 'If PayPal asks for a ZIP code, enter 6 digits (e.g. 700000 or 100000).' : 'Nếu PayPal yêu cầu nhập Mã bưu chính (ZIP code), vui lòng điền 6 chữ số (Ví dụ: TP.HCM: 700000, Hà Nội: 100000).'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* TAB 6: TRỢ GIÚP, PHẢN HỒI & PHÁP LÝ (ĐÃ CHUYỂN DỜI CÁC LIÊN KẾT PHÁP LÝ SANG ĐÂY) */}
          {activeTab === 'help' && (
            <section className="help-section">
              <h2>{isEn ? 'Help, Support & Legal' : 'Trợ giúp & Phản hồi'}</h2>
              <p className="settings-modal__hint">
                {isEn 
                  ? 'Have questions, need support, or wish to review legal documents? Reach out to the MedChat247 development team below.'
                  : 'Gặp khó khăn khi sử dụng hoặc muốn đóng góp ý kiến nâng cấp hệ thống? Bạn có thể gửi phản hồi trực tiếp cho đội ngũ phát triển MedChat247 tại đây.'
                }
              </p>

              {/* CARD MỚI: VĂN BẢN PHÁP LÝ & QUYỀN RIÊNG TƯ (DỜI TỪ TAB TÀI KHOẢN SANG ĐÂY) */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  <ShieldCheckIcon /> {isEn ? 'Legal & Privacy Documentation' : 'Văn bản Pháp lý & Quyền riêng tư'}
                </h3>
                <p className="settings-modal__hint" style={{ marginBottom: '14px' }}>
                  {isEn
                    ? 'Read our official terms of service and medical data confidentiality commitments.'
                    : 'Xem các văn bản pháp lý chính thức và cam kết bảo vệ dữ liệu y tế của MedChat247.'
                  }
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--outline btn--sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ShieldCheckIcon /> {isEn ? 'Privacy Policy' : 'Chính sách bảo mật'}
                  </a>
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--outline btn--sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileTextIcon /> {isEn ? 'Terms of Service' : 'Điều khoản sử dụng'}
                  </a>
                </div>
              </div>

              <div className="settings-divider" />

              {/* Toggle: Gửi mới / Lịch sử */}
              <div className="help-tabs-toggle">
                <button
                  className={`help-tab-btn ${!showFeedbackHistory ? 'active' : ''}`}
                  onClick={() => setShowFeedbackHistory(false)}
                >
                  {isEn ? 'Submit New Feedback' : 'Gửi phản hồi mới'}
                </button>
                {isLoggedIn && (
                  <button
                    className={`help-tab-btn ${showFeedbackHistory ? 'active' : ''}`}
                    onClick={() => { setShowFeedbackHistory(true); loadMyFeedbacks(); }}
                  >
                    {isEn ? `Feedback History (${myFeedbacks.length})` : `Lịch sử phản hồi (${myFeedbacks.length})`}
                  </button>
                )}
              </div>

              {!showFeedbackHistory ? (
                <>
                  {/* Form gửi phản hồi */}
                  <form onSubmit={handleSubmitFeedback} style={{ marginTop: '16px' }}>

                    <label className="settings-field">
                      <span>{isEn ? 'Feedback Type' : 'Loại phản hồi'}</span>
                      <select
                        value={feedbackCategory}
                        onChange={e => setFeedbackCategory(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                        }}
                      >
                        <option value="help">{isEn ? 'Help (Request reply)' : 'Trợ giúp (cần phản hồi)'}</option>
                        <option value="bug">{isEn ? 'Bug Report' : 'Báo lỗi (Bug)'}</option>
                        <option value="feature">{isEn ? 'Feature Request' : 'Yêu cầu tính năng mới'}</option>
                        <option value="question">{isEn ? 'Question' : 'Câu hỏi'}</option>
                        <option value="complaint">{isEn ? 'Complaint' : 'Khiếu nại'}</option>
                        <option value="other">{isEn ? 'Other' : 'Khác'}</option>
                      </select>
                    </label>

                    <label className="settings-field">
                      <span>{isEn ? 'Priority Level' : 'Mức độ ưu tiên'}</span>
                      <select
                        value={feedbackPriority}
                        onChange={e => setFeedbackPriority(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                        }}
                      >
                        <option value="low">{isEn ? 'Low' : 'Thấp'}</option>
                        <option value="medium">{isEn ? 'Medium' : 'Trung bình'}</option>
                        <option value="high">{isEn ? 'High' : 'Cao'}</option>
                        <option value="urgent">{isEn ? 'Urgent' : 'Khẩn cấp'}</option>
                      </select>
                    </label>

                    <label className="settings-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span>{isEn ? 'Feedback Content' : 'Nội dung phản hồi'}</span>
                      <textarea
                        name="feedback"
                        placeholder={isEn ? "Describe your question or issue in detail..." : "Mô tả chi tiết câu hỏi hoặc vấn đề bạn gặp phải..."}
                        rows={5}
                        required
                        value={feedbackContent}
                        onChange={e => setFeedbackContent(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                          fontFamily: 'inherit',
                          fontSize: '13px',
                          resize: 'vertical',
                          minHeight: '100px',
                        }}
                      />
                    </label>

                    {/* Toggle gửi ẩn danh */}
                    <div className="auto-renew-row" style={{ marginTop: '4px' }}>
                      <div className="auto-renew-text">
                        <strong>{isEn ? 'Submit Anonymously' : 'Gửi ẩn danh'}</strong>
                        <p className="auto-renew-hint">
                          {feedbackAnonymous
                            ? (isEn ? 'Your name and email will be hidden.' : 'Tên và email của bạn sẽ bị ẩn với admin.')
                            : (isEn ? 'Admin will see your account name and email.' : 'Admin sẽ thấy tên và email tài khoản của bạn.')
                          }
                        </p>
                      </div>
                      <label className={`toggle-switch ${feedbackCategory === 'help' ? 'toggle-switch--disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={feedbackAnonymous}
                          onChange={e => setFeedbackAnonymous(e.target.checked)}
                          disabled={feedbackCategory === 'help'}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button type="submit" className="btn btn--primary" disabled={feedbackSubmitting || !feedbackContent.trim()}>
                        {feedbackSubmitting ? (isEn ? 'Submitting...' : 'Đang gửi...') : (isEn ? 'Submit Feedback' : 'Gửi phản hồi')}
                      </button>
                    </div>
                  </form>

                  <div className="faq-box" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>{isEn ? 'Frequently Asked Questions (FAQ)' : 'Câu hỏi thường gặp (FAQ)'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {isEn ? '1. Is MedChat247 medical diagnosis accurate?' : '1. MedChat247 chẩn đoán có chính xác không?'}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          {isEn 
                            ? 'The system provides preliminary reference and symptom screening based on clinical knowledge graphs. Results do not replace professional physician diagnosis.'
                            : 'Hệ thống chỉ mang tính chất sàng lọc và tư vấn ban đầu dựa trên đồ thị tri thức lâm sàng SymCAT. Kết quả không thay thế chẩn đoán của bác sĩ chuyên khoa.'
                          }
                        </span>
                      </div>
                      <div>
                        <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {isEn ? '2. Why do question counts vary between turns?' : '2. Tại sao số lượng câu hỏi lại thay đổi giữa các lượt?'}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          {isEn
                            ? 'The AI automatically calculates differential symptom coverage to output 3 to 5 optimal follow-up questions.'
                            : 'Hệ thống tự động phân tích độ phủ và tầm quan trọng của các triệu chứng phân biệt còn lại để đưa ra từ 3 đến 5 câu hỏi tối ưu nhất.'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Lịch sử phản hồi của user */
                <div style={{ marginTop: '16px' }}>
                  {myFeedbacksLoading ? (
                    <p className="settings-modal__hint">{isEn ? 'Loading history...' : 'Đang tải lịch sử...'}</p>
                  ) : myFeedbacks.length === 0 ? (
                    <div className="empty-memory-state">
                      <p className="empty-title">{isEn ? 'No feedback submitted yet.' : 'Chưa có phản hồi nào.'}</p>
                      <p className="empty-desc">{isEn ? 'Your submitted feedback will appear here.' : 'Các phản hồi bạn gửi sẽ hiển thị tại đây.'}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {myFeedbacks.map(fb => (
                        <div key={fb.id} className="feedback-history-card card-box">
                          <div className="fb-history-header">
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span className={`priority-badge priority-${fb.priority}`}>
                                {fb.priority === 'urgent' ? (isEn ? 'Urgent' : 'Khẩn cấp') :
                                 fb.priority === 'high' ? (isEn ? 'High' : 'Cao') :
                                 fb.priority === 'medium' ? (isEn ? 'Medium' : 'TB') : (isEn ? 'Low' : 'Thấp')}
                              </span>
                              <span className={`category-badge category-${fb.category}`}>
                                {fb.category === 'help' ? (isEn ? 'Help' : 'Trợ giúp') :
                                 fb.category === 'bug' ? (isEn ? 'Bug' : 'Báo lỗi') :
                                 fb.category === 'feature' ? (isEn ? 'Feature' : 'Tính năng') :
                                 fb.category === 'question' ? (isEn ? 'Question' : 'Câu hỏi') :
                                 fb.category === 'complaint' ? (isEn ? 'Complaint' : 'Khiếu nại') : (isEn ? 'Other' : 'Khác')}
                              </span>
                              <span className={`status-badge status-${fb.status}`}>
                                {fb.status === 'new' ? (isEn ? 'New' : 'Mới') :
                                 fb.status === 'read' ? (isEn ? 'Read' : 'Đã đọc') :
                                 fb.status === 'in_progress' ? (isEn ? 'In Progress' : 'Đang xử lý') :
                                 fb.status === 'resolved' ? (isEn ? 'Resolved' : 'Đã giải quyết') : (isEn ? 'Closed' : 'Đã đóng')}
                              </span>
                            </div>
                            <span className="text-xs text-muted">
                              {new Date(fb.createdAt).toLocaleString(isEn ? 'en-US' : 'vi-VN')}
                            </span>
                          </div>
                          <p className="fb-history-content">{fb.content}</p>
                          {fb.adminReply && (
                            <div className="admin-reply-box">
                              <strong>{isEn ? 'MedChat247 Support Reply:' : 'Phản hồi từ đội ngũ MedChat247:'}</strong>
                              <p style={{ margin: '4px 0 0' }}>{fb.adminReply}</p>
                              {fb.repliedAt && (
                                <span className="text-xs text-muted" style={{ display: 'block', marginTop: '4px' }}>
                                  {new Date(fb.repliedAt).toLocaleString(isEn ? 'en-US' : 'vi-VN')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* MODAL XÁC NHẬN THANH TOÁN PAYPAL NÂNG CẤP PRO */}
      {confirmPaymentModal && (
        <div className="modal-backdrop modal-backdrop--nested" onClick={() => setConfirmPaymentModal(false)}>
          <div className="confirm-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-payment-header">
              <SparklesIcon />
              <h3>{isEn ? 'Upgrade to Pro Specialist (PayPal)' : 'Nâng cấp gói Pro Chuyên Gia (PayPal)'}</h3>
            </div>
            <p className="confirm-payment-desc">
              {isEn
                ? 'Complete payment of 99,000đ (~$3.99 USD) via PayPal for 30 days of Pro features:'
                : 'Hoàn tất thanh toán 99.000đ (~$3.99 USD) qua cổng PayPal để nâng cấp 30 ngày sử dụng gói Pro Chuyên Gia:'
              }
            </p>
            <div style={{ padding: '16px 0', minHeight: '120px' }}>
              <div id="paypal-button-container" />
            </div>
            <div className="confirm-modal-actions">
              <button
                className="btn btn--outline"
                onClick={() => setConfirmPaymentModal(false)}
              >
                {isEn ? 'Close / Cancel' : 'Đóng / Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
