import { useState, useEffect } from 'react'
import {
  UserCircleIcon,
  GaugeIcon,
  CreditCardIcon,
  HelpCircleIcon,
  TrashIcon,
  SearchIcon,
  CheckIcon,
  SpinnerIcon
} from './Icons'
import './DashboardView.css'

export default function DashboardView({ account, onBack, onSignOut, lang, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'account')
  const [isAdmin, setIsAdmin] = useState(account.role === 'admin')

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // State tài khoản
  const [name, setName] = useState(account.name)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)

  // State thanh toán
  const [billingInfo, setBillingInfo] = useState(account)
  const [invoices, setInvoices] = useState([])
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [billingMsg, setBillingMsg] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(null) // 'card' | 'momo'
  
  // State form liên kết thẻ
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  
  // State form liên kết Momo
  const [momoPhone, setMomoPhone] = useState('')
  const [momoOtp, setMomoOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // State Admin Panel
  const [adminTab, setAdminTab] = useState('stats')
  const [adminStats, setAdminStats] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminPayments, setAdminPayments] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editPlan, setEditPlan] = useState('free')
  const [editRole, setEditRole] = useState('user')
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  // Cập nhật lại thông tin user từ prop
  useEffect(() => {
    setBillingInfo(account)
    setIsAdmin(account.role === 'admin')
  }, [account])

  // Lấy lịch sử giao dịch cá nhân
  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/payments/history')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.history || [])
      }
    } catch (err) {
      console.error('Lỗi lấy lịch sử giao dịch:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'billing' || activeTab === 'invoices') {
      fetchInvoices()
    }
  }, [activeTab])

  // Đếm ngược gửi mã OTP Momo
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // ─── XỬ LÝ TÀI KHOẢN ────────────────────────────────────────────────────────
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg('')
    setProfileErr('')
    setLoadingProfile(true)
    try {
      // 1. Cập nhật tên hiển thị nếu thay đổi
      if (name.trim() !== account.name) {
        const res = await fetch('/api/account/name', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Lỗi cập nhật tên.')
        }
      }

      // 2. Đổi mật khẩu nếu có nhập
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('Mật khẩu xác nhận không khớp.')
        }
        const res = await fetch('/api/account/password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPassword, newPassword })
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Lỗi đổi mật khẩu.')
        }
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }

      setProfileMsg('Cập nhật hồ sơ tài khoản thành công!')
      // Reload lại trang sau 1s để cập nhật prop account
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setProfileErr(err.message)
    } finally {
      setLoadingProfile(false)
    }
  }

  // ─── XỬ LÝ THANH TOÁN ───────────────────────────────────────────────────────
  const handleLinkCard = async (e) => {
    e.preventDefault()
    setBillingMsg('')
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      alert('Vui lòng nhập đầy đủ thông tin thẻ.')
      return
    }
    setLoadingBilling(true)
    try {
      const last4 = cardNumber.replace(/\s/g, '').slice(-4)
      const brand = cardNumber.startsWith('4') ? 'Visa' : cardNumber.startsWith('5') ? 'Mastercard' : 'Credit Card'

      const res = await fetch('/api/payments/link-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4, brand })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi liên kết thẻ.')

      setBillingInfo(data.user)
      setShowLinkModal(null)
      setCardName('')
      setCardNumber('')
      setCardExpiry('')
      setCardCvc('')
      setBillingMsg('Đã liên kết thẻ tín dụng thành công!')
      fetchInvoices()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoadingBilling(false)
    }
  }

  const handleSendMomoOtp = (e) => {
    e.preventDefault()
    if (!momoPhone || momoPhone.length < 10) {
      alert('Vui lòng nhập số điện thoại Ví MoMo hợp lệ.')
      return
    }
    setOtpSent(true)
    setCountdown(60)
    setMomoOtp('1234') // Mã test mặc định
  }

  const handleLinkMomo = async (e) => {
    e.preventDefault()
    if (!momoOtp) {
      alert('Vui lòng nhập mã OTP.')
      return
    }
    setLoadingBilling(true)
    try {
      const res = await fetch('/api/payments/link-momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: momoPhone, otp: momoOtp })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi liên kết ví.')

      setBillingInfo(data.user)
      setShowLinkModal(null)
      setMomoPhone('')
      setMomoOtp('')
      setOtpSent(false)
      setBillingMsg('Đã liên kết Ví MoMo thành công!')
      fetchInvoices()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoadingBilling(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('Bạn có chắc chắn muốn hủy liên kết phương thức thanh toán định kỳ này?')) return
    setLoadingBilling(true)
    try {
      const res = await fetch('/api/payments/unlink', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi hủy liên kết.')

      setBillingInfo(data.user)
      setBillingMsg('Đã hủy liên kết nguồn tiền thành công.')
      fetchInvoices()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoadingBilling(false)
    }
  }

  const handleToggleAutoRenew = async (checked) => {
    try {
      const res = await fetch('/api/payments/toggle-autorenew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenew: checked })
      })
      const data = await res.json()
      if (res.ok) {
        setBillingInfo(data.user)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleTriggerRenewTest = async () => {
    setLoadingBilling(true)
    setBillingMsg('')
    try {
      const res = await fetch('/api/payments/trigger-renew-test', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setBillingInfo(data.user)
        setBillingMsg('Kiểm thử gia hạn thành công! Tài khoản của bạn đã được cộng hạn ngạch cước.')
        fetchInvoices()
      } else {
        throw new Error(data.error || 'Thanh toán tự động bị từ chối.')
      }
    } catch (err) {
      alert(`[Lỗi gia hạn tự động]: ${err.message}`)
    } finally {
      setLoadingBilling(false)
    }
  }

  // ─── TÁC VỤ ADMIN ──────────────────────────────────────────────────────────
  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setAdminStats(data.stats)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`/api/admin/users?page=${userPage}&search=${encodeURIComponent(searchUser)}`)
      if (res.ok) {
        const data = await res.json()
        setAdminUsers(data.users || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAdminPayments = async () => {
    try {
      const res = await fetch('/api/admin/payments')
      if (res.ok) {
        const data = await res.json()
        setAdminPayments(data.payments || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      if (adminTab === 'stats') fetchAdminStats()
      if (adminTab === 'users') fetchAdminUsers()
      if (adminTab === 'payments') fetchAdminPayments()
    }
  }, [activeTab, adminTab, userPage, searchUser])

  const handleSaveUserEdit = async (userId) => {
    setLoadingAdmin(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: editPlan, role: editRole })
      })
      if (res.ok) {
        setEditingUserId(null)
        fetchAdminUsers()
      } else {
        const data = await res.json()
        alert(data.error || 'Lỗi lưu thông tin.')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoadingAdmin(false)
    }
  }

  const handleResetTokens = async (userId) => {
    if (!confirm('Bạn có muốn reset số lượng token đã sử dụng của tài khoản này về 0?')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetTokens: true })
      })
      if (res.ok) fetchAdminUsers()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Hành động này sẽ XÓA VĨNH VIỄN tài khoản người dùng này. Bạn có chắc chắn?')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (res.ok) fetchAdminUsers()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__header">
          <span className="dashboard-avatar">{account.name.charAt(0).toUpperCase()}</span>
          <div>
            <h3>{account.name}</h3>
            <p>{account.email}</p>
          </div>
        </div>

        <nav className="dashboard-sidebar__nav">
          <button
            className={`dashboard-sidebar__btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <UserCircleIcon />
            <span>Thông tin cá nhân</span>
          </button>
          <button
            className={`dashboard-sidebar__btn ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CreditCardIcon />
            <span>Gói cước &amp; Gia hạn</span>
          </button>
          <button
            className={`dashboard-sidebar__btn ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <GaugeIcon />
            <span>Lịch sử hóa đơn</span>
          </button>

          {isAdmin && (
            <>
              <div className="dashboard-sidebar__divider" />
              <button
                className={`dashboard-sidebar__btn dashboard-sidebar__btn--admin ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <HelpCircleIcon />
                <span>Admin Panel</span>
              </button>
            </>
          )}
        </nav>

        <div className="dashboard-sidebar__footer">
          <button className="dashboard-sidebar__back" onClick={onBack}>
            ← Quay lại ứng dụng
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-content">
        <header className="dashboard-content__header">
          <h2>{activeTab === 'account' ? 'Hồ sơ tài khoản' : activeTab === 'billing' ? 'Nâng cấp gói & Cấu hình thanh toán' : activeTab === 'invoices' ? 'Lịch sử thanh toán cước' : 'Quản trị hệ thống MedChat'}</h2>
          <button className="btn-back-chat" onClick={onBack}>Bắt đầu Chat →</button>
        </header>

        <div className="dashboard-content__body">
          {/* TAB 1: THÔNG TIN TÀI KHOẢN */}
          {activeTab === 'account' && (
            <div className="card-glass shadow-lg">
              <form onSubmit={handleUpdateProfile} className="form-settings">
                <h3>Cập nhật thông tin</h3>
                
                {profileMsg && <div className="alert-success">{profileMsg}</div>}
                {profileErr && <div className="alert-danger">{profileErr}</div>}

                <div className="input-group-grid">
                  <div className="form-field">
                    <label>Tên hiển thị</label>
                    <input value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="form-field">
                    <label>Email đăng ký</label>
                    <input value={account.email} disabled className="disabled-input" />
                  </div>
                </div>

                {account.provider !== 'google' && (
                  <>
                    <h3 className="mt-6">Đổi mật khẩu bảo mật</h3>
                    <div className="form-field">
                      <label>Mật khẩu cũ hiện tại</label>
                      <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Nhập để xác thực quyền sở hữu" />
                    </div>
                    <div className="input-group-grid">
                      <div className="form-field">
                        <label>Mật khẩu mới</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
                      </div>
                      <div className="form-field">
                        <label>Xác nhận mật khẩu mới</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
                      </div>
                    </div>
                  </>
                )}

                <button type="submit" className="btn-submit" disabled={loadingProfile}>
                  {loadingProfile ? <SpinnerIcon className="animate-spin" /> : 'Lưu mọi thay đổi'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: GÓI CƯỚC & LIÊN KẾT THANH TOÁN */}
          {activeTab === 'billing' && (
            <div className="billing-layout">
              {billingMsg && <div className="alert-success w-full mb-4">{billingMsg}</div>}

              {/* Status cước hiện tại */}
              <div className="card-glass billing-status">
                <h3>Trạng thái gói cước hiện tại</h3>
                <div className="status-grid">
                  <div>
                    <span className="text-muted">Gói đang dùng</span>
                    <h2 className="text-highlight uppercase">{billingInfo.planId}</h2>
                  </div>
                  <div>
                    <span className="text-muted">Hình thức gia hạn</span>
                    <div className="toggle-wrapper">
                      <span>Tự động gia hạn</span>
                      <input
                        type="checkbox"
                        checked={billingInfo.autoRenew}
                        onChange={e => handleToggleAutoRenew(e.target.checked)}
                        disabled={!billingInfo.billingToken}
                      />
                    </div>
                    {!billingInfo.billingToken && <p className="text-sm text-muted mt-1">(Cần liên kết thẻ/ví để bật)</p>}
                  </div>
                </div>

                {billingInfo.billingToken && (
                  <div className="linked-method-card mt-6">
                    <div>
                      <h4>Phương thức thanh toán đã liên kết:</h4>
                      {billingInfo.billingMethod === 'stripe' ? (
                        <p className="card-details">💳 Thẻ **{billingInfo.billingDetails?.brand}** (Đuôi *{billingInfo.billingDetails?.last4})</p>
                      ) : (
                        <p className="card-details">📱 Ví MoMo (SĐT: {billingInfo.billingDetails?.momoPhone})</p>
                      )}
                    </div>
                    <div className="linked-actions">
                      <button className="btn-unlink" onClick={handleUnlink}>Hủy liên kết</button>
                      <button className="btn-trigger-test" onClick={handleTriggerRenewTest} disabled={loadingBilling}>
                        {loadingBilling ? <SpinnerIcon className="animate-spin" /> : 'Gia hạn thử nghiệm ngay'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Thẻ bảng giá */}
              <div className="pricing-grid mt-6">
                <div className={`pricing-card card-glass ${billingInfo.planId === 'free' ? 'pricing-card--active' : ''}`}>
                  <h3>FREE PLAN</h3>
                  <div className="price">0đ<span>/tháng</span></div>
                  <ul>
                    <li>✓ 50.000 tokens sử dụng</li>
                    <li>✓ Khám nhi khoa cơ bản</li>
                    <li>✓ Thời gian phản hồi tiêu chuẩn</li>
                  </ul>
                </div>
                <div className={`pricing-card card-glass ${billingInfo.planId === 'pro' ? 'pricing-card--active' : ''}`}>
                  <div className="card-badge">KHUYÊN DÙNG</div>
                  <h3>PRO PLAN</h3>
                  <div className="price">99.000đ<span>/tháng</span></div>
                  <ul>
                    <li>✓ 2.000.000 tokens sử dụng</li>
                    <li>✓ Đầy đủ các khoa kết nối</li>
                    <li>✓ Ưu tiên tốc độ tối đa</li>
                    <li>✓ Tự động gia hạn qua Visa/Momo</li>
                  </ul>
                  {!billingInfo.billingToken ? (
                    <div className="link-button-group mt-6">
                      <button className="btn-link-visa" onClick={() => setShowLinkModal('card')}>Liên kết Visa / Mastercard</button>
                      <button className="btn-link-momo" onClick={() => setShowLinkModal('momo')}>Liên kết Ví MoMo</button>
                    </div>
                  ) : billingInfo.planId !== 'pro' ? (
                    <button className="btn-submit mt-6" onClick={handleTriggerRenewTest} disabled={loadingBilling}>
                      {loadingBilling ? <SpinnerIcon className="animate-spin" /> : 'Nâng cấp lên gói PRO'}
                    </button>
                  ) : (
                    <div className="pro-active-msg mt-6">✓ Bạn đang sử dụng gói Pro</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LỊCH SỬ HÓA ĐƠN */}
          {activeTab === 'invoices' && (
            <div className="card-glass">
              <h3>Bảng kê khai hóa đơn cước</h3>
              <div className="table-responsive mt-4">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Mã giao dịch</th>
                      <th>Ngày thanh toán</th>
                      <th>Gói cước</th>
                      <th>Cổng</th>
                      <th>Loại</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted">Chưa có giao dịch thanh toán nào được thực hiện.</td>
                      </tr>
                    ) : (
                      invoices.map(inv => (
                        <tr key={inv.id}>
                          <td className="font-mono text-sm">{inv.id.slice(0, 8)}...</td>
                          <td>{new Date(inv.createdAt).toLocaleString('vi-VN')}</td>
                          <td className="uppercase">{inv.planId}</td>
                          <td className="uppercase">{inv.paymentGateway}</td>
                          <td>{inv.type === 'recurring' ? 'Định kỳ' : 'Lần đầu'}</td>
                          <td className="font-semibold">{inv.amount.toLocaleString('vi-VN')}đ</td>
                          <td>
                            <span className={`badge-status badge-${inv.status}`}>
                              {inv.status === 'success' ? 'Thành công' : inv.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ADMIN PANEL */}
          {activeTab === 'admin' && isAdmin && (
            <div className="admin-layout">
              <div className="admin-tabs">
                <button className={`admin-tab-btn ${adminTab === 'stats' ? 'active' : ''}`} onClick={() => setAdminTab('stats')}>Thống kê tổng quan</button>
                <button className={`admin-tab-btn ${adminTab === 'users' ? 'active' : ''}`} onClick={() => setAdminTab('users')}>Quản lý thành viên</button>
                <button className={`admin-tab-btn ${adminTab === 'payments' ? 'active' : ''}`} onClick={() => setAdminTab('payments')}>Lịch sử giao dịch</button>
              </div>

              {/* Sub-tab 1: Stats */}
              {adminTab === 'stats' && adminStats && (
                <div className="admin-stats-grid mt-4">
                  <div className="stat-box card-glass">
                    <span className="text-muted">Tổng số thành viên</span>
                    <h2>{adminStats.totalUsers}</h2>
                  </div>
                  <div className="stat-box card-glass">
                    <span className="text-muted">Tổng doanh thu hệ thống</span>
                    <h2 className="text-success">{adminStats.totalRevenue.toLocaleString('vi-VN')}đ</h2>
                  </div>
                  <div className="stat-box card-glass">
                    <span className="text-muted">Tổng token đã tiêu thụ</span>
                    <h2>{adminStats.totalTokensUsed.toLocaleString('vi-VN')}</h2>
                  </div>
                  <div className="stat-box card-glass">
                    <span className="text-muted">Phân bổ gói Pro / Free</span>
                    <h2>{adminStats.planDistribution?.pro} / {adminStats.planDistribution?.free}</h2>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Users */}
              {adminTab === 'users' && (
                <div className="admin-users-panel mt-4">
                  <div className="search-bar">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Tìm theo tên hoặc email thành viên..."
                      value={searchUser}
                      onChange={e => { setSearchUser(e.target.value); setUserPage(1); }}
                    />
                  </div>

                  <div className="table-responsive mt-4">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Tên thành viên</th>
                          <th>Email</th>
                          <th>Gói cước</th>
                          <th>Quyền</th>
                          <th>Token đã dùng</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map(u => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>
                              {editingUserId === u.id ? (
                                <select value={editPlan} onChange={e => setEditPlan(e.target.value)}>
                                  <option value="free">Free</option>
                                  <option value="pro">Pro</option>
                                </select>
                              ) : (
                                <span className={`plan-badge plan-${u.planId}`}>{u.planId}</span>
                              )}
                            </td>
                            <td>
                              {editingUserId === u.id ? (
                                <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span className="uppercase text-sm font-semibold">{u.role}</span>
                              )}
                            </td>
                            <td className="font-mono">{u.tokensUsed?.toLocaleString('vi-VN') || 0}</td>
                            <td>
                              <div className="action-buttons-flex">
                                {editingUserId === u.id ? (
                                  <>
                                    <button className="btn-action-save" onClick={() => handleSaveUserEdit(u.id)} disabled={loadingAdmin}>Lưu</button>
                                    <button className="btn-action-cancel" onClick={() => setEditingUserId(null)}>Hủy</button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn-action-edit" onClick={() => {
                                      setEditingUserId(u.id)
                                      setEditPlan(u.planId)
                                      setEditRole(u.role)
                                    }}>Sửa</button>
                                    <button className="btn-action-reset" onClick={() => handleResetTokens(u.id)}>Reset Token</button>
                                    <button className="btn-action-delete" onClick={() => handleDeleteUser(u.id)}><TrashIcon /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Phân trang */}
                  {totalPages > 1 && (
                    <div className="pagination mt-4">
                      <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}>Trước</button>
                      <span>Trang {userPage} / {totalPages}</span>
                      <button disabled={userPage === totalPages} onClick={() => setUserPage(p => p + 1)}>Sau</button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: Payments */}
              {adminTab === 'payments' && (
                <div className="admin-payments-panel mt-4">
                  <div className="table-responsive">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>ID giao dịch</th>
                          <th>Khách hàng</th>
                          <th>Gói</th>
                          <th>Số tiền</th>
                          <th>Cổng</th>
                          <th>Ngày giao dịch</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminPayments.map(p => (
                          <tr key={p.id}>
                            <td className="font-mono text-sm">{p.id.slice(0, 8)}...</td>
                            <td>
                              <div>
                                <span className="font-semibold">{p.user?.name}</span>
                                <br />
                                <span className="text-muted text-xs">{p.user?.email}</span>
                              </div>
                            </td>
                            <td className="uppercase">{p.planId}</td>
                            <td className="font-semibold">{p.amount.toLocaleString('vi-VN')}đ</td>
                            <td className="uppercase">{p.paymentGateway}</td>
                            <td>{new Date(p.createdAt).toLocaleString('vi-VN')}</td>
                            <td>
                              <span className={`badge-status badge-${p.status}`}>
                                {p.status === 'success' ? 'Thành công' : p.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* POPUP LIÊN KẾT VISA/MASTERCARD */}
      {showLinkModal === 'card' && (
        <div className="modal-backdrop" onClick={() => setShowLinkModal(null)}>
          <div className="payment-modal card-glass" onClick={e => e.stopPropagation()}>
            <header>
              <h3>Liên kết Thẻ Visa / Mastercard</h3>
              <button className="modal-close" onClick={() => setShowLinkModal(null)}>×</button>
            </header>
            <form onSubmit={handleLinkCard} className="form-card-link">
              <div className="credit-card-preview">
                <span className="card-brand">{cardNumber.startsWith('4') ? 'Visa' : 'Mastercard'}</span>
                <div className="card-number-display">{cardNumber || '•••• •••• •••• ••••'}</div>
                <div className="card-bottom">
                  <span>{cardName.toUpperCase() || 'TEN CHU THE'}</span>
                  <span>{cardExpiry || 'MM/YY'}</span>
                </div>
              </div>

              <div className="form-field mt-4">
                <label>Họ tên chủ thẻ</label>
                <input
                  type="text"
                  placeholder="VIET DUNG TRAN"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Số thẻ</label>
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                  maxLength="19"
                  required
                />
              </div>
              <div className="input-group-grid">
                <div className="form-field">
                  <label>Ngày hết hạn</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={e => setCardExpiry(e.target.value)}
                    maxLength="5"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>CVC / CVV</label>
                  <input
                    type="password"
                    placeholder="•••"
                    value={cardCvc}
                    onChange={e => setCardCvc(e.target.value)}
                    maxLength="3"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-submit mt-6" disabled={loadingBilling}>
                {loadingBilling ? <SpinnerIcon className="animate-spin" /> : 'Xác thực & Liên kết thẻ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP LIÊN KẾT VÍ MOMO */}
      {showLinkModal === 'momo' && (
        <div className="modal-backdrop" onClick={() => setShowLinkModal(null)}>
          <div className="payment-modal card-glass" onClick={e => e.stopPropagation()}>
            <header>
              <h3>Liên kết Ví MoMo</h3>
              <button className="modal-close" onClick={() => setShowLinkModal(null)}>×</button>
            </header>
            
            {!otpSent ? (
              <form onSubmit={handleSendMomoOtp} className="form-card-link">
                <div className="momo-brand-banner">MOMO SUBSCRIPTION</div>
                <div className="form-field mt-4">
                  <label>Số điện thoại đăng ký MoMo</label>
                  <input
                    type="text"
                    placeholder="0987654321"
                    value={momoPhone}
                    onChange={e => setMomoPhone(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <button type="submit" className="btn-submit mt-6">
                  Gửi mã xác thực OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleLinkMomo} className="form-card-link">
                <div className="momo-brand-banner">MOMO SUBSCRIPTION</div>
                <p className="text-sm mt-4">Đã gửi mã xác thực tới số **{momoPhone}**. (Để chạy thử nghiệm, bạn nhập mã mặc định là **1234**).</p>
                <div className="form-field mt-4">
                  <label>Mã xác thực OTP (4 số)</label>
                  <input
                    type="text"
                    placeholder="Nhập 1234 để liên kết thử"
                    value={momoOtp}
                    onChange={e => setMomoOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength="4"
                    required
                  />
                </div>
                <button type="submit" className="btn-submit mt-6" disabled={loadingBilling}>
                  {loadingBilling ? <SpinnerIcon className="animate-spin" /> : 'Xác nhận mã OTP & Liên kết ví'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
