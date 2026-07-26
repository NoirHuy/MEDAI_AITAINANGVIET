import { useEffect, useState } from 'react'
import { CloseIcon, UserCircleIcon, GaugeIcon, CreditCardIcon, CheckIcon, HelpCircleIcon, SparklesIcon, LockIcon, TrashIcon, BrainIcon } from './Icons'
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

const TABS = [
  { id: 'account', label: 'Tài khoản', Icon: UserCircleIcon },
  { id: 'memory', label: 'Trí nhớ cá nhân', Icon: BrainIcon },
  { id: 'usage', label: 'Mức sử dụng', Icon: GaugeIcon },
  { id: 'subscription', label: 'Gói thuê bao', Icon: SparklesIcon },
  { id: 'payment', label: 'Thanh toán', Icon: CreditCardIcon },
  { id: 'help', label: 'Trợ giúp & Phản hồi', Icon: HelpCircleIcon },
]

export default function SettingsModal({
  activeTab,
  onClose,
  onChangeTab,
  account,
  onUpdateName,
  onChangePassword,
  onUpdateCard,
  onDeleteCard,
  onToggleAutoRenew,
  onSetPlan,
  onSignOut,
  onFetchUsage,
  showToast,
}) {
  const [nameDraft, setNameDraft] = useState(account?.name || '')
  const [usage, setUsage] = useState(null)
  const [usageError, setUsageError] = useState(null)

  // State cho Đổi Mật Khẩu
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // State cho Thẻ Thanh Toán
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [cardStatus, setCardStatus] = useState(null)
  const [cardLoading, setCardLoading] = useState(false)
  const [deleteCardLoading, setDeleteCardLoading] = useState(false)
  const [editingCard, setEditingCard] = useState(!account?.billingDetails)

  useEffect(() => {
    setEditingCard(!account?.billingDetails)
  }, [account?.billingDetails])

  // State cho Nâng Cấp Gói & Thanh Toán
  const [confirmPaymentModal, setConfirmPaymentModal] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)

  // State cho Trí Nhớ Thông Minh Cá Nhân
  const [memories, setMemories] = useState([])
  const [memorySettings, setMemorySettings] = useState({
    memoryEnabled: true,
    autoRememberAllergies: true,
    autoRememberChronic: true,
    autoRememberMedications: true,
    autoRememberEpisodes: true
  })
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState('allergy')
  const [newMemorySubject, setNewMemorySubject] = useState('self')

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
      setMemorySettings(setRes.settings || {})
    } catch (err) {
      console.error('[Memory] Error loading memory profile:', err)
    } finally {
      setMemoryLoading(false)
    }
  }

  async function handleToggleMemorySetting(key, val) {
    try {
      const next = { ...memorySettings, [key]: val }
      setMemorySettings(next)
      await apiRequest('/api/memories/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: val })
      })
      showToast?.('Đã cập nhật cài đặt trí nhớ.')
    } catch (err) {
      showToast?.(err.message || 'Không thể lưu cài đặt.')
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
      showToast?.('Đã thêm mục trí nhớ mới.')
    } catch (err) {
      showToast?.(err.message || 'Không thể thêm trí nhớ.')
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
      showToast?.(nextLock ? 'Đã khóa ký ức (AI không được tự ý ghi đè).' : 'Đã mở khóa ký ức.')
    } catch (err) {
      showToast?.(err.message || 'Không thể thay đổi trạng thái khóa.')
    }
  }

  async function handleDeleteSingleMemory(id) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mục trí nhớ này khỏi hồ sơ?')) return
    try {
      await apiRequest(`/api/memories/${id}`, { method: 'DELETE' })
      setMemories((prev) => prev.filter((m) => m.id !== id))
      showToast?.('Đã xóa mục trí nhớ.')
    } catch (err) {
      showToast?.(err.message || 'Không thể xóa mục trí nhớ.')
    }
  }

  async function handleClearAllMemoriesClick() {
    if (!window.confirm('CẢNH BÁO: Hành động này sẽ XÓA MỀM toàn bộ hồ sơ trí nhớ y tế của bạn. Bạn có chắc chắn không?')) return
    try {
      await apiRequest('/api/memories', { method: 'DELETE' })
      setMemories([])
      showToast?.('Đã xóa toàn bộ hồ sơ trí nhớ.')
    } catch (err) {
      showToast?.(err.message || 'Không thể xóa toàn bộ.')
    }
  }

  function handleExportMemoryProfileClick() {
    window.open('/api/memories/export', '_blank')
  }

  // Xử lý Xóa Thẻ Thanh Toán
  async function handleDeleteCardClick() {
    const cardLast4 = account?.billingDetails?.cardLast4 || ''
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thẻ thanh toán (•••• ${cardLast4}) khỏi tài khoản?`)) return
    try {
      setDeleteCardLoading(true)
      await onDeleteCard()
      setEditingCard(true)
      setCardNumber('')
      setCardHolder('')
      setCardExpiry('')
      setCardCvc('')
      showToast?.('Đã xóa thẻ thanh toán thành công!')
    } catch (err) {
      showToast?.(err.message || 'Không thể xóa thẻ.')
    } finally {
      setDeleteCardLoading(false)
    }
  }

  // Xử lý bấm Chuyển Gói chuẩn Quy Tắc Thanh Toán
  function handleSelectPlanClick(targetPlanId) {
    if (targetPlanId === account.planId) return
    if (targetPlanId === 'pro') {
      // Yêu cầu bắt buộc phải có thẻ thanh toán mới được nâng cấp
      if (!account.billingDetails || !account.billingDetails.cardLast4) {
        showToast?.('Vui lòng thêm thẻ thanh toán (Visa/MasterCard/JCB) trước khi nâng cấp gói Pro.')
        onChangeTab('payment')
        return
      }
      // Nếu đã có thẻ -> Mở Modal Xác Nhận Thanh Toán & Trừ Tiền
      setConfirmPaymentModal(true)
    } else {
      if (window.confirm('Bạn có chắc chắn muốn chuyển về gói Miễn phí?')) {
        processPlanChange('free')
      }
    }
  }

  // Tiến hành gọi API đổi gói
  async function processPlanChange(planId) {
    try {
      setPlanLoading(true)
      await onSetPlan(planId)
      setConfirmPaymentModal(false)
      if (planId === 'pro') {
        showToast?.('Thanh toán 99.000đ thành công! Đã kích hoạt gói Pro (30 ngày).')
      } else {
        showToast?.('Đã chuyển về gói Miễn phí.')
      }
    } catch (err) {
      showToast?.(err.message || 'Không thể nâng cấp gói.')
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

  if (!activeTab || !account) return null

  const plan = getPlan(account.planId)
  const usagePercent = usage
    ? Math.min(100, Math.round((usage.tokensUsed / usage.tokenLimit) * 100))
    : 0

  const isGoogleAccount = account.provider === 'google'
  const isAutoRenewOn = account.autoRenew !== false

  // Định dạng số thẻ tự động nhóm 4 số
  function handleCardNumberChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 19)
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw
    setCardNumber(formatted)
  }

  // Định dạng ngày hết hạn MM/YY
  function handleCardExpiryChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`)
    } else {
      setCardExpiry(raw)
    }
  }

  // Xử lý đổi mật khẩu
  async function handleChangePasswordSubmit(e) {
    e.preventDefault()
    setPasswordStatus(null)

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'Mật khẩu xác nhận không trùng khớp.' })
      return
    }

    try {
      setPasswordLoading(true)
      await onChangePassword({ oldPassword, newPassword })
      setPasswordStatus({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast?.('Đổi mật khẩu thành công!')
    } catch (err) {
      setPasswordStatus({ type: 'error', text: err.message || 'Không thể đổi mật khẩu.' })
    } finally {
      setPasswordLoading(false)
    }
  }

  // Xử lý lưu thẻ thanh toán
  async function handleSaveCardSubmit(e) {
    e.preventDefault()
    setCardStatus(null)

    try {
      setCardLoading(true)
      await onUpdateCard({
        cardNumber,
        holderName: cardHolder,
        expiry: cardExpiry,
        cvc: cardCvc,
      })
      setCardStatus({ type: 'success', text: 'Đã lưu thẻ thanh toán thành công!' })
      setEditingCard(false)
      showToast?.('Đã lưu thẻ thanh toán thành công!')
    } catch (err) {
      setCardStatus({ type: 'error', text: err.message || 'Thẻ không hợp lệ.' })
    } finally {
      setCardLoading(false)
    }
  }

  // Xử lý bật/tắt gia hạn tự động
  async function handleToggleAutoRenewClick() {
    try {
      const nextState = !isAutoRenewOn
      await onToggleAutoRenew(nextState)
      showToast?.(nextState ? 'Đã BẬT gia hạn tự động' : 'Đã TẮT gia hạn tự động')
    } catch (err) {
      showToast?.(err.message)
    }
  }

  // Tính ngày đăng ký & ngày hết hạn
  const regDate = account.createdAt ? new Date(account.createdAt).toLocaleDateString('vi-VN') : '22/07/2026'
  const expDate = account.subscriptionExpiresAt
    ? new Date(account.subscriptionExpiresAt).toLocaleDateString('vi-VN')
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN')

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
          {/* TAB 1: TÀI KHOẢN (HỒ SƠ & ĐỔI MẬT KHẨU) */}
          {activeTab === 'account' && (
            <section>
              <h2>Hồ sơ tài khoản</h2>
              <p className="settings-modal__hint">
                Thông tin tài khoản cá nhân được lưu trữ an toàn trên cơ sở dữ liệu hệ thống.
              </p>

              <div className="settings-section-box">
                <label className="settings-field">
                  <span>Tên hiển thị</span>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Email</span>
                  <input value={account.email} disabled />
                </label>
                <div className="settings-modal__actions" style={{ marginTop: '12px' }}>
                  <button className="btn btn--primary" onClick={() => onUpdateName(nameDraft)}>
                    Lưu thay đổi tên
                  </button>
                  <button className="btn btn--danger-outline" onClick={onSignOut}>
                    Đăng xuất
                  </button>
                </div>
              </div>

              <div className="settings-divider" />

          {/* TAB 2: TRÍ NHỚ THÔNG MINH CÁ NHÂN */}
          {activeTab === 'memory' && (
            <section className="memory-tab-section">
              <div className="memory-header-row">
                <div>
                  <h2>Trí nhớ thông minh cá nhân</h2>
                  <p className="settings-modal__hint">
                    Hệ thống tự động ghi nhớ và cá nhân hóa trải nghiệm tham vấn dựa trên tiền sử y tế của bạn. Tất cả dữ liệu được mã hóa <strong>AES-256-GCM</strong> bảo mật tuyệt đối.
                  </p>
                </div>
                <button
                  className="btn btn--outline btn--sm"
                  onClick={handleExportMemoryProfileClick}
                  title="Tải về tóm tắt tiền sử y tế cá nhân dạng tệp văn bản"
                >
                  📄 Xuất hồ sơ (.txt)
                </button>
              </div>

              {/* TÙY CHỈNH TỰ ĐỘNG GHI NHỚ */}
              <div className="settings-section-box mb-4">
                <div className="memory-toggle-row">
                  <div>
                    <strong>Bật tính năng Trí nhớ thông minh</strong>
                    <p className="text-muted text-xs">Cho phép AI tham khảo và trích xuất tiền sử y tế của bạn.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={memorySettings.memoryEnabled !== false}
                      onChange={(e) => handleToggleMemorySetting('memoryEnabled', e.target.checked)}
                    />
                    <span className="slider round" />
                  </label>
                </div>

                {memorySettings.memoryEnabled !== false && (
                  <div className="memory-sub-toggles mt-3 pt-3 border-t">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Tự động ghi nhớ theo danh mục:</span>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberAllergies !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberAllergies', e.target.checked)}
                        />
                        <span>Dị ứng thuốc & thức ăn</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberChronic !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberChronic', e.target.checked)}
                        />
                        <span>Bệnh nền mãn tính</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberMedications !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberMedications', e.target.checked)}
                        />
                        <span>Thuốc đang sử dụng</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memorySettings.autoRememberEpisodes !== false}
                          onChange={(e) => handleToggleMemorySetting('autoRememberEpisodes', e.target.checked)}
                        />
                        <span>Đợt bệnh ngắn hạn (90 ngày)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* FORM THÊM TRÍ NHỚ THỦ CÔNG */}
              <form onSubmit={handleAddMemorySubmit} className="memory-add-form settings-section-box mb-4">
                <h3 className="settings-subheading text-sm mb-2">➕ Thêm tiền sử y tế thủ công</h3>
                <div className="memory-form-grid">
                  <select
                    className="memory-select"
                    value={newMemoryCategory}
                    onChange={(e) => setNewMemoryCategory(e.target.value)}
                  >
                    <option value="allergy">🚨 Dị ứng (Allergy)</option>
                    <option value="chronic_condition">🏥 Bệnh nền (Chronic)</option>
                    <option value="medication">💊 Thuốc đang dùng (Medication)</option>
                    <option value="blood_type">🩸 Nhóm máu (Blood Type)</option>
                    <option value="pregnancy">👶 Thai kỳ (Pregnancy)</option>
                    <option value="past_episode">📋 Đợt bệnh trước (Past Episode)</option>
                    <option value="lifestyle">🏃 Lối sống (Lifestyle)</option>
                    <option value="display_preference">⚙️ Hiển thị (Preference)</option>
                  </select>

                  <select
                    className="memory-select"
                    value={newMemorySubject}
                    onChange={(e) => setNewMemorySubject(e.target.value)}
                  >
                    <option value="self">👤 Bản thân tôi</option>
                    <option value="family">👨‍👩‍👧 Tiền sử gia đình</option>
                  </select>

                  <input
                    type="text"
                    className="memory-input"
                    placeholder="Nhập thông tin y tế (ví dụ: Dị ứng Penicillin nặng)..."
                    value={newMemoryContent}
                    onChange={(e) => setNewMemoryContent(e.target.value)}
                  />

                  <button type="submit" className="btn btn--primary btn--sm" disabled={!newMemoryContent.trim()}>
                    Thêm vào hồ sơ
                  </button>
                </div>
              </form>

              {/* DANH SÁCH MỤC TRÍ NHỚ ĐÃ LƯU */}
              <div className="settings-section-box">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="settings-subheading text-sm font-bold">
                    🧠 Hồ sơ Trí nhớ cá nhân hiện tại ({memories.length} mục)
                  </h3>
                  {memories.length > 0 && (
                    <button
                      className="btn btn--danger-outline btn--xs"
                      onClick={handleClearAllMemoriesClick}
                    >
                      Xóa toàn bộ
                    </button>
                  )}
                </div>

                {memoryLoading ? (
                  <p className="text-center text-muted py-4">Đang tải hồ sơ trí nhớ đã mã hóa...</p>
                ) : memories.length === 0 ? (
                  <div className="empty-memory-state text-center py-6 text-muted">
                    <p className="mb-1">Chưa có thông tin trí nhớ y tế nào được lưu.</p>
                    <p className="text-xs">Khi bạn trò chuyện với MedChatAI hoặc nhập ở trên, các thông tin quan trọng sẽ được lưu tự động tại đây.</p>
                  </div>
                ) : (
                  <div className="memory-item-list">
                    {memories.map((mem) => (
                      <div className={`memory-card-item ${mem.isLocked ? 'is-locked' : ''}`} key={mem.id}>
                        <div className="memory-card-header">
                          <span className={`memory-cat-badge memory-cat--${mem.category}`}>
                            {mem.category === 'allergy' && '🚨 Dị ứng'}
                            {mem.category === 'chronic_condition' && '🏥 Bệnh nền'}
                            {mem.category === 'medication' && '💊 Thuốc dùng'}
                            {mem.category === 'blood_type' && '🩸 Nhóm máu'}
                            {mem.category === 'pregnancy' && '👶 Thai kỳ'}
                            {mem.category === 'past_episode' && '📋 Đợt bệnh'}
                            {mem.category === 'lifestyle' && '🏃 Lối sống'}
                            {mem.category === 'display_preference' && '⚙️ Hiển thị'}
                          </span>
                          <span className={`memory-subject-badge subject--${mem.subject}`}>
                            {mem.subject === 'family' ? '👨‍👩‍👧 Gia đình' : '👤 Bản thân'}
                          </span>
                          {mem.isLocked && (
                            <span className="memory-locked-badge" title="Đã khóa: AI không được tự ý sửa mục này">
                              🔒 Đã khóa
                            </span>
                          )}
                          <span className="memory-source-tag">
                            {mem.source === 'manual' ? 'Thủ công' : 'AI Trích xuất'} (v{mem.version || 1})
                          </span>
                        </div>

                        <div className="memory-card-body">
                          <p className="memory-content-text">{mem.content}</p>
                        </div>

                        <div className="memory-card-footer">
                          <span className="memory-date-text">
                            Cập nhật: {new Date(mem.updatedAt || mem.createdAt).toLocaleDateString('vi-VN')}
                          </span>

                          <div className="memory-actions-row">
                            <button
                              className={`btn-icon-sm ${mem.isLocked ? 'text-amber-500' : 'text-gray-400'}`}
                              onClick={() => handleToggleLockSingleMemory(mem.id, mem.isLocked)}
                              title={mem.isLocked ? 'Mở khóa ký ức' : 'Khóa ký ức (Ngăn AI sửa đổi)'}
                            >
                              <LockIcon />
                            </button>
                            <button
                              className="btn-icon-sm text-red-500"
                              onClick={() => handleDeleteSingleMemory(mem.id)}
                              title="Xóa mục trí nhớ này"
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

              {/* HỘP CẢNH BÁO PHÁP LÝ CỐ ĐỊNH */}
              <div className="medical-disclaimer-box mt-4">
                <span className="disclaimer-icon">⚠️</span>
                <p>
                  <strong>Khuyến cáo pháp lý Y tế:</strong> Thông tin trong Trí nhớ cá nhân được sử dụng nhằm mục đích cá nhân hóa các gợi ý tham khảo y tế, không phải là Hồ sơ bệnh án y tế chính thức và không thay thế chẩn đoán lâm sàng của bác sĩ chuyên khoa.
                </p>
              </div>
            </section>
          )}

              <div className="settings-divider" />

              {/* MỤC ĐỔI MẬT KHẨU */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  <LockIcon /> Đổi mật khẩu
                </h3>

                {isGoogleAccount ? (
                  <div className="settings-info-badge">
                    <span>🔒</span>
                    <p>Tài khoản của bạn đăng nhập bằng <strong>Google OAuth</strong> nên không sử dụng mật khẩu riêng.</p>
                  </div>
                ) : (
                  <form onSubmit={handleChangePasswordSubmit} className="change-password-form">
                    {passwordStatus && (
                      <div className={`settings-alert settings-alert--${passwordStatus.type}`}>
                        {passwordStatus.text}
                      </div>
                    )}
                    <label className="settings-field">
                      <span>Mật khẩu hiện tại</span>
                      <input
                        type="password"
                        placeholder="Nhập mật khẩu hiện tại..."
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Mật khẩu mới</span>
                      <input
                        type="password"
                        placeholder="Tối thiểu 6 ký tự..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </label>
                    <label className="settings-field">
                      <span>Xác nhận mật khẩu mới</span>
                      <input
                        type="password"
                        placeholder="Nhập lại mật khẩu mới..."
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </label>
                    <div style={{ marginTop: '14px' }}>
                      <button type="submit" className="btn btn--primary" disabled={passwordLoading}>
                        {passwordLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          )}

          {/* TAB 2: MỨC SỬ DỤNG */}
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

          {/* TAB 3: GÓI THUÊ BAO */}
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
                        className={`btn ${isCurrent ? 'btn--outline' : (p.id === 'free' && account.planId === 'pro' ? 'btn--outline' : 'btn--primary')}`}
                        disabled={isCurrent || (p.id === 'free' && account.planId === 'pro')}
                        onClick={() => handleSelectPlanClick(p.id)}
                      >
                        {isCurrent ? 'Gói hiện tại' : (p.id === 'free' && account.planId === 'pro' ? 'Gói cơ bản' : `Chuyển sang ${p.name}`)}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="settings-modal__hint">
                Chuyển đổi gói trải nghiệm linh hoạt giữa gói Miễn phí và Pro y tế cao cấp.
              </p>
            </section>
          )}

          {/* TAB 4: THANH TOÁN (MỚI: VISA/MASTERCARD & THÔNG TIN HẠN PRO) */}
          {activeTab === 'payment' && (
            <section>
              <h2>Thanh toán &amp; Thẻ ngân hàng</h2>
              <p className="settings-modal__hint">
                Quản lý thẻ Visa, MasterCard, JCB và thiết lập gia hạn tự động cho gói Pro y tế.
              </p>

              {/* THÔNG TIN HẠN SỬ DỤNG GÓI */}
              <div className="subscription-status-box">
                <div className="status-header">
                  <div>
                    <span className="status-label">Trạng thái gói Pro</span>
                    <h3 className="status-title">
                      {account.planId === 'pro' ? 'Gói Pro Chuyên Gia (Active)' : 'Gói Miễn Phí (Free)'}
                    </h3>
                  </div>
                  <span className={`status-pill status-pill--${account.planId === 'pro' ? 'active' : 'free'}`}>
                    {account.planId === 'pro' ? 'Đang hoạt động' : 'Miễn phí'}
                  </span>
                </div>

                {account.planId === 'pro' && (
                  <div className="date-info-grid">
                    <div className="date-item">
                      <span>Ngày đăng ký Pro</span>
                      <strong>{regDate}</strong>
                    </div>
                    <div className="date-item">
                      <span>Ngày hết hạn</span>
                      <strong>{expDate}</strong>
                    </div>
                  </div>
                )}

                {/* CÔNG TẮC GIA HẠN TỰ ĐỘNG (DEFAULT ON) */}
                <div className="auto-renew-row">
                  <div className="auto-renew-text">
                    <strong>Gia hạn tự động</strong>
                    <p className="auto-renew-hint">
                      {isAutoRenewOn
                        ? 'Đang BẬT (Mặc định). Hệ thống sẽ tự động gia hạn gói Pro khi đến hạn.'
                        : 'Đang TẮT. Gói Pro sẽ tự động chuyển về gói Miễn phí sau ngày hết hạn.'}
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isAutoRenewOn}
                      onChange={handleToggleAutoRenewClick}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              <div className="settings-divider" />

              {/* MỤC THÊM / QUẢN LÝ THẺ VISA, MASTERCARD */}
              <div className="settings-section-box">
                <h3 className="settings-subheading">
                  <CreditCardIcon /> Thẻ thanh toán quốc tế (Visa / MasterCard / JCB)
                </h3>

                {account.billingDetails && !editingCard ? (
                  <div className="saved-card-widget">
                    <div className="card-chip-brand">
                      <span className="card-brand-badge">{account.billingDetails.brand || 'Visa'}</span>
                      <span className="card-last4">•••• •••• •••• {account.billingDetails.cardLast4}</span>
                    </div>
                    <div className="card-details-row">
                      <span>Chủ thẻ: <strong>{account.billingDetails.holderName}</strong></span>
                      <span>Hết hạn: <strong>{account.billingDetails.expiry}</strong></span>
                    </div>
                    <div className="card-actions-group" style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() => setEditingCard(true)}
                      >
                        Thay đổi thẻ
                      </button>
                      <button
                        className="btn btn--danger-outline btn--sm"
                        disabled={deleteCardLoading}
                        onClick={handleDeleteCardClick}
                      >
                        <TrashIcon /> {deleteCardLoading ? 'Đang xóa...' : 'Xóa thẻ thanh toán'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveCardSubmit} className="credit-card-form">
                    {cardStatus && (
                      <div className={`settings-alert settings-alert--${cardStatus.type}`}>
                        {cardStatus.text}
                      </div>
                    )}
                    <label className="settings-field">
                      <span>Số thẻ (Visa, MasterCard, JCB, AMEX)</span>
                      <input
                        type="text"
                        placeholder="4000 1234 5678 9010"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        required
                      />
                    </label>
                    <label className="settings-field">
                      <span>Tên in trên thẻ (Tên chủ thẻ)</span>
                      <input
                        type="text"
                        placeholder="LE QUANG HUY"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                        required
                      />
                    </label>
                    <div className="form-row-two">
                      <label className="settings-field">
                        <span>Hạn thẻ (MM/YY)</span>
                        <input
                          type="text"
                          placeholder="12/28"
                          value={cardExpiry}
                          onChange={handleCardExpiryChange}
                          required
                        />
                      </label>
                      <label className="settings-field">
                        <span>Mã bảo mật (CVC/CVV)</span>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                          required
                        />
                      </label>
                    </div>

                    <div className="form-actions-row">
                      <button type="submit" className="btn btn--primary" disabled={cardLoading}>
                        {cardLoading ? 'Đang lưu...' : 'Lưu phương thức thanh toán'}
                      </button>
                      {account.billingDetails && (
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => setEditingCard(false)}
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </section>
          )}

          {/* TAB 5: TRỢ GIÚP & PHẢN HỒI */}
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

      {/* MODAL XÁC NHẬN THANH TOÁN 99.000đ NÂNG CẤP PRO */}
      {confirmPaymentModal && (
        <div className="modal-backdrop modal-backdrop--nested" onClick={() => setConfirmPaymentModal(false)}>
          <div className="confirm-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-payment-header">
              <SparklesIcon />
              <h3>Xác nhận thanh toán nâng cấp Pro</h3>
            </div>
            <p className="confirm-payment-desc">
              Số tiền <strong>99.000đ / tháng</strong> sẽ được trừ trực tiếp vào thẻ thanh toán của bạn để kích hoạt 30 ngày sử dụng gói Pro:
            </p>
            <div className="confirm-card-box">
              <div className="card-chip-brand">
                <span className="card-brand-badge">{account.billingDetails?.brand || 'Visa'}</span>
                <span className="card-last4">•••• •••• •••• {account.billingDetails?.cardLast4}</span>
              </div>
              <div className="card-details-row">
                <span>Chủ thẻ: <strong>{account.billingDetails?.holderName}</strong></span>
                <span>Hết hạn: <strong>{account.billingDetails?.expiry}</strong></span>
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button
                className="btn btn--primary"
                disabled={planLoading}
                onClick={() => processPlanChange('pro')}
              >
                {planLoading ? 'Đang xử lý...' : 'Xác nhận thanh toán 99.000đ'}
              </button>
              <button
                className="btn btn--outline"
                onClick={() => setConfirmPaymentModal(false)}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
