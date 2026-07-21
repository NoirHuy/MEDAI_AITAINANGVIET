import { useState, useEffect } from 'react'
import {
  UserCircleIcon,
  GaugeIcon,
  CreditCardIcon,
  HelpCircleIcon,
  TrashIcon,
  SearchIcon,
  CheckIcon,
  SpinnerIcon,
  PulseIcon,
  CloseIcon
} from './Icons'
import './DashboardView.css'

export default function DashboardView({ account, onBack, onSignOut, lang, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview')
  const [isAdmin, setIsAdmin] = useState(account.role === 'admin')

  // State các dữ liệu quản trị
  const [overviewStats, setOverviewStats] = useState(null)
  const [conversations, setConversations] = useState([])
  const [searchConv, setSearchConv] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterLang, setFilterLang] = useState('')
  const [filterGuest, setFilterGuest] = useState('')
  const [convPage, setConvPage] = useState(1)
  const [totalConvPages, setTotalConvPages] = useState(1)
  
  // Chi tiết hội thoại đang xem
  const [selectedConv, setSelectedConv] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [showFlagInput, setShowFlagInput] = useState(false)

  // Danh sách log an toàn & Ops
  const [safetyLogs, setSafetyLogs] = useState([])
  const [opsLogs, setOpsLogs] = useState(null)

  // Quản lý User (Cũ)
  const [users, setUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [totalUserPages, setTotalUserPages] = useState(1)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editPlan, setEditPlan] = useState('free')
  const [editRole, setEditRole] = useState('user')

  // Quản lý Thanh toán & Doanh thu
  const [payments, setPayments] = useState([])
  const [payPage, setPayPage] = useState(1)
  const [totalPayPages, setTotalPayPages] = useState(1)
  const [filterPayStatus, setFilterPayStatus] = useState('')
  const [filterPayGateway, setFilterPayGateway] = useState('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setIsAdmin(account.role === 'admin')
  }, [account])

  // Tự động load dữ liệu tùy thuộc vào tab đang active
  useEffect(() => {
    if (!isAdmin) return

    const loadData = async () => {
      setLoading(true)
      try {
        if (activeTab === 'overview') {
          const res = await fetch('/api/admin/stats/overview')
          if (res.ok) {
            const data = await res.json()
            setOverviewStats(data.overview)
          }
        } else if (activeTab === 'conversations') {
          const queryParams = new URLSearchParams({
            page: convPage,
            limit: 8,
            search: searchConv,
            urgency: filterUrgency,
            lang: filterLang,
            isGuest: filterGuest
          })
          const res = await fetch(`/api/admin/conversations?${queryParams}`)
          if (res.ok) {
            const data = await res.json()
            setConversations(data.conversations || [])
            setTotalConvPages(data.pagination?.totalPages || 1)
          }
        } else if (activeTab === 'safety') {
          const res = await fetch('/api/admin/safety-logs')
          if (res.ok) {
            const data = await res.json()
            setSafetyLogs(data.logs || [])
          }
        } else if (activeTab === 'users') {
          const res = await fetch(`/api/admin/users?page=${userPage}&search=${encodeURIComponent(searchUser)}`)
          if (res.ok) {
            const data = await res.json()
            setUsers(data.users || [])
            setTotalUserPages(data.pagination?.totalPages || 1)
          }
        } else if (activeTab === 'ops') {
          const res = await fetch('/api/admin/ops/logs')
          if (res.ok) {
            const data = await res.json()
            setOpsLogs(data.ops)
          }
        } else if (activeTab === 'payments') {
          const queryParams = new URLSearchParams({
            page: payPage,
            limit: 8,
            status: filterPayStatus,
            gateway: filterPayGateway
          })
          const res = await fetch(`/api/admin/payments?${queryParams}`)
          if (res.ok) {
            const data = await res.json()
            setPayments(data.payments || [])
            setTotalPayPages(data.pagination?.totalPages || 1)
          }
        }
      } catch (err) {
        console.error('Lỗi khi lấy dữ liệu admin:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [activeTab, convPage, searchConv, filterUrgency, filterLang, filterGuest, userPage, searchUser, payPage, filterPayStatus, filterPayGateway, isAdmin])

  // Xem chi tiết hội thoại
  const handleViewDetails = async (convId) => {
    try {
      const res = await fetch(`/api/admin/conversations/${convId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedConv(data.conversation)
        setFlagReason(data.conversation.flaggedReason || '')
        setShowFlagInput(false)
        setShowDetailModal(true)
      }
    } catch (err) {
      alert('Không thể tải chi tiết cuộc hội thoại.')
    }
  }

  // Gắn cờ/Gỡ cờ hội thoại
  const handleToggleFlag = async () => {
    if (!selectedConv) return
    const nextFlag = !selectedConv.flagged
    try {
      const res = await fetch(`/api/admin/conversations/${selectedConv.id}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged: nextFlag, flaggedReason: flagReason })
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedConv(data.conversation)
        setShowFlagInput(false)
        // Refresh danh sách
        if (activeTab === 'conversations') {
          setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, flagged: nextFlag, flaggedReason: nextFlag ? flagReason : null } : c))
        } else if (activeTab === 'safety') {
          setSafetyLogs(prev => prev.map(c => c.id === selectedConv.id ? { ...c, flagged: nextFlag, flaggedReason: nextFlag ? flagReason : null } : c))
        }
        alert(nextFlag ? 'Đã gắn cờ cuộc hội thoại thành công!' : 'Đã gỡ cờ cuộc hội thoại.')
      }
    } catch (err) {
      alert('Không thể thực hiện gắn cờ.')
    }
  }

  // Xuất file báo cáo kiểm toán hội thoại (JSON format)
  const handleExportAudit = (conv) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conv, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `MedChat_Audit_Session_${conv.id}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Quản lý người dùng
  const handleSaveUserEdit = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: editPlan, role: editRole })
      })
      if (res.ok) {
        setEditingUserId(null)
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, planId: editPlan, role: editRole } : u))
        alert('Cập nhật quyền hạn thành viên thành công!')
      }
    } catch (err) {
      alert('Lỗi cập nhật người dùng.')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Xóa tài khoản này đồng thời sẽ xóa mọi phiên hội thoại liên quan. Bạn có chắc chắn?')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleResetTokens = async (userId) => {
    if (!confirm('Đặt lại số token đã dùng về 0?')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetTokens: true })
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, tokensUsed: 0 } : u))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Xuất báo cáo hoạt động định kỳ (Tuần/Tháng) dạng tóm tắt
  const handleExportPeriodicReport = (type) => {
    const reportData = {
      reportType: type === 'week' ? 'Báo cáo Tuần' : 'Báo cáo Tháng',
      generatedAt: new Date().toLocaleString('vi-VN'),
      metrics: overviewStats ? {
        totalChats: overviewStats.chatCounts,
        activeUsers: overviewStats.activeUsers,
        emergencyRate: `${overviewStats.emergencyRate}%`,
        avgResponseTime: `${overviewStats.avgResponseTimeMs}ms`,
        topSymptoms: overviewStats.topSymptoms
      } : 'No data available'
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `MedChat_Periodic_Report_${type}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Phân loại nhãn khẩn cấp
  const renderUrgencyBadge = (urgency) => {
    if (urgency === 'emergency') {
      return <span className="urgency-tag tag-red">Khẩn cấp (Đỏ)</span>
    } else if (urgency === 'warning') {
      return <span className="urgency-tag tag-yellow">Cần theo dõi (Vàng)</span>
    }
    return <span className="urgency-tag tag-green">Bình thường (Xanh)</span>
  }

  return (
    <div className="admin-dashboard-root">
      {/* Sidebar Navigation */}
      <aside className="admin-side">
        <div className="admin-side__brand">
          <PulseIcon className="pulse-icon-blue" />
          <h2>MedChat Admin</h2>
        </div>

        <div className="admin-side__user">
          <span className="admin-avatar-initial">{account.name.charAt(0).toUpperCase()}</span>
          <div>
            <h4>{account.name}</h4>
            <p className="role-tag">Hệ thống Vận hành</p>
          </div>
        </div>

        <nav className="admin-side__nav">
          <button className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <GaugeIcon />
            <span>Tổng quan hệ thống</span>
          </button>
          <button className={`admin-nav-item ${activeTab === 'conversations' ? 'active' : ''}`} onClick={() => { setActiveTab('conversations'); setConvPage(1); }}>
            <UserCircleIcon />
            <span>Quản lý hội thoại</span>
          </button>
          <button className={`admin-nav-item ${activeTab === 'safety' ? 'active' : ''}`} onClick={() => setActiveTab('safety')}>
            <CheckIcon />
            <span>An toàn y tế</span>
          </button>
          <button className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setUserPage(1); }}>
            <UserCircleIcon />
            <span>Quản lý thành viên</span>
          </button>
          <button className={`admin-nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => { setActiveTab('payments'); setPayPage(1); }}>
            <CreditCardIcon />
            <span>Thanh toán &amp; Doanh thu</span>
          </button>
          <button className={`admin-nav-item ${activeTab === 'ops' ? 'active' : ''}`} onClick={() => setActiveTab('ops')}>
            <HelpCircleIcon />
            <span>Giám sát vận hành</span>
          </button>
        </nav>

        <footer className="admin-side__foot">
          <button className="btn-exit-admin" onClick={onBack}>
            ← Quay lại Chat
          </button>
        </footer>
      </aside>

      {/* Main Panel Content */}
      <main className="admin-main">
        {loading && <div className="loading-bar-spinner"><SpinnerIcon className="animate-spin" /><span>Đang kết nối dữ liệu y khoa...</span></div>}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && overviewStats && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Tổng Quan Vận Hành</h1>
              <p>Thống kê xu hướng triệu chứng và chất lượng tư vấn lâm sàng của Bot.</p>
            </header>

            {/* Metrics cards */}
            <div className="overview-cards">
              <div className="overview-card">
                <span className="card-label">Hội thoại mới (Hôm nay/Tuần/Tháng)</span>
                <h2>{overviewStats.chatCounts.today} / {overviewStats.chatCounts.week} / {overviewStats.chatCounts.month}</h2>
                <div className="card-trend text-blue">Hoạt động ổn định</div>
              </div>
              <div className="overview-card">
                <span className="card-label">Doanh thu hệ thống</span>
                <h2 className="text-success-custom">{(overviewStats.totalRevenue || 0).toLocaleString('vi-VN')} đ</h2>
                <div className="card-trend text-success-custom">Thanh toán &amp; Auto-billing</div>
              </div>
              <div className="overview-card">
                <span className="card-label">Thành viên Premium (Pro)</span>
                <h2>{overviewStats.proUsersCount || 0}</h2>
                <div className="card-trend text-blue">Đăng ký trả phí hoạt động</div>
              </div>
              <div className="overview-card">
                <span className="card-label">Người dùng hoạt động (Tháng)</span>
                <h2>{overviewStats.activeUsers}</h2>
                <div className="card-trend text-blue">Thành viên và vãng lai</div>
              </div>
              <div className="overview-card">
                <span className="card-label">Tỷ lệ khẩn cấp (Cấp cứu)</span>
                <h2 className="text-danger-custom">{overviewStats.emergencyRate}%</h2>
                <div className="card-trend">Đề xuất đi cấp cứu</div>
              </div>
              <div className="overview-card">
                <span className="card-label">Phản hồi trung bình</span>
                <h2>{overviewStats.avgResponseTimeMs}ms</h2>
                <div className="card-trend text-success-custom">Tốc độ tối ưu</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-grid mt-6">
              {/* Left Chart: Top Symptoms */}
              <div className="chart-box card-box">
                <h3>Triệu chứng y tế hỏi nhiều nhất (Top Symptoms)</h3>
                <p className="chart-subtitle">Tần suất xuất hiện triệu chứng được bot trích xuất từ hội thoại</p>
                <div className="symptoms-bar-chart mt-4">
                  {overviewStats.topSymptoms.map((symp, i) => {
                    const maxVal = Math.max(...overviewStats.topSymptoms.map(s => s.count)) || 1
                    const percent = Math.round((symp.count / maxVal) * 100)
                    return (
                      <div className="symptom-bar-row" key={i}>
                        <span className="symptom-name">{symp._id}</span>
                        <div className="bar-wrapper">
                          <div className="bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="symptom-val">{symp.count} lượt</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Chart: Urgency Donut Chart */}
              <div className="chart-box card-box">
                <h3>Phân bổ mức độ nguy cơ (Urgency Distribution)</h3>
                <p className="chart-subtitle">Phân loại khẩn cấp được xác định tự động qua chẩn đoán lâm sàng</p>
                
                <div className="donut-chart-container mt-4">
                  <svg viewBox="0 0 36 36" className="donut-svg">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="var(--bg-app)" strokeWidth="3" />
                    {/* SVG Donut logic segments */}
                    {(() => {
                      const total = overviewStats.urgencyDistribution.emergency + overviewStats.urgencyDistribution.warning + overviewStats.urgencyDistribution.normal
                      const ePct = total > 0 ? (overviewStats.urgencyDistribution.emergency / total) * 100 : 15
                      const wPct = total > 0 ? (overviewStats.urgencyDistribution.warning / total) * 100 : 25
                      const nPct = total > 0 ? (overviewStats.urgencyDistribution.normal / total) * 100 : 60
                      
                      // Calculate offset strokes
                      const strokeE = `${ePct} ${100 - ePct}`
                      const strokeW = `${wPct} ${100 - wPct}`
                      const strokeN = `${nPct} ${100 - nPct}`
                      
                      return (
                        <>
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray={strokeN} strokeDashoffset="0" />
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#fbbf24" strokeWidth="3" strokeDasharray={strokeW} strokeDashoffset={-nPct} />
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#ef4444" strokeWidth="3" strokeDasharray={strokeE} strokeDashoffset={-(nPct + wPct)} />
                        </>
                      )
                    })()}
                  </svg>
                  <div className="donut-labels">
                    <div className="donut-label-row"><span className="dot dot-green" /><span>Bình thường: {overviewStats.urgencyDistribution.normal}</span></div>
                    <div className="donut-label-row"><span className="dot dot-yellow" /><span>Cần theo dõi: {overviewStats.urgencyDistribution.warning}</span></div>
                    <div className="donut-label-row"><span className="dot dot-red" /><span>Khẩn cấp: {overviewStats.urgencyDistribution.emergency}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Periodic reports generation */}
            <div className="card-box mt-6 block-reports">
              <h3>Báo cáo vận hành định kỳ</h3>
              <p className="chart-subtitle">Tải dữ liệu phân tích định kỳ cho tổ chuyên môn hoặc bộ phận Ops</p>
              <div className="flex-buttons mt-4">
                <button className="btn-report-dl blue" onClick={() => handleExportPeriodicReport('week')}>Xuất báo cáo tuần này (JSON)</button>
                <button className="btn-report-dl blue-soft" onClick={() => handleExportPeriodicReport('month')}>Xuất báo cáo tháng này (JSON)</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONVERSATIONS */}
        {activeTab === 'conversations' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Quản Lý Hội Thoại</h1>
              <p>Audit và giám sát lịch sử tư vấn y khoa của chatbot.</p>
            </header>

            {/* Search & Filters */}
            <div className="filters-bar card-box mb-4">
              <div className="search-input-wrapper">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Tìm kiếm tiêu đề cuộc hội thoại..."
                  value={searchConv}
                  onChange={e => { setSearchConv(e.target.value); setConvPage(1); }}
                />
              </div>

              <div className="filter-dropdowns">
                <select value={filterUrgency} onChange={e => { setFilterUrgency(e.target.value); setConvPage(1); }}>
                  <option value="">-- Mức nguy cơ --</option>
                  <option value="normal">Bình thường</option>
                  <option value="warning">Cần theo dõi</option>
                  <option value="emergency">Khẩn cấp</option>
                </select>

                <select value={filterLang} onChange={e => { setFilterLang(e.target.value); setConvPage(1); }}>
                  <option value="">-- Ngôn ngữ --</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>

                <select value={filterGuest} onChange={e => { setFilterGuest(e.target.value); setConvPage(1); }}>
                  <option value="">-- Tài khoản --</option>
                  <option value="false">Đã đăng ký</option>
                  <option value="true">Khách vãng lai</option>
                </select>
              </div>
            </div>

            {/* Table conversations */}
            <div className="card-box">
              <div className="table-responsive">
                <table className="admin-table-custom">
                  <thead>
                    <tr>
                      <th>ID phiên</th>
                      <th>Cuộc hội thoại</th>
                      <th>Ngôn ngữ</th>
                      <th>Người dùng</th>
                      <th>Mức nguy cơ</th>
                      <th>Phản hồi</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center-muted">Không tìm thấy phiên hội thoại phù hợp.</td>
                      </tr>
                    ) : (
                      conversations.map(c => (
                        <tr key={c.id}>
                          <td className="font-mono text-sm text-muted">{c.id.slice(0, 8)}...</td>
                          <td>
                            <strong>{c.title}</strong>
                            <br />
                            <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                          </td>
                          <td className="uppercase text-xs font-semibold">{c.lang}</td>
                          <td>
                            {c.isGuest ? (
                              <span className="guest-pill">Guest (Vãng lai)</span>
                            ) : (
                              <span className="user-pill">Member</span>
                            )}
                          </td>
                          <td>{renderUrgencyBadge(c.urgency)}</td>
                          <td>{c.responseTimeMs ? `${c.responseTimeMs}ms` : 'N/A'}</td>
                          <td>
                            {c.flagged ? (
                              <span className="flagged-warn" title={c.flaggedReason}>🚩 Đã gắn cờ</span>
                            ) : (
                              <span className="text-xs text-muted">Bình thường</span>
                            )}
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button className="btn-table-action blue" onClick={() => handleViewDetails(c.id)}>Chi tiết</button>
                              <button className="btn-table-action gray" onClick={() => handleExportAudit(c)} title="Xuất JSON kiểm toán">Xuất File</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalConvPages > 1 && (
                <div className="pagination-bar mt-4">
                  <button disabled={convPage === 1} onClick={() => setConvPage(p => p - 1)}>← Trước</button>
                  <span>Trang {convPage} / {totalConvPages}</span>
                  <button disabled={convPage === totalConvPages} onClick={() => setConvPage(p => p + 1)}>Sau →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MEDICAL SAFETY (AN TOÀN Y TẾ) */}
        {activeTab === 'safety' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>An Toàn Y Tế</h1>
              <p>Audit lâm sàng các trường hợp bot đã đưa ra cảnh báo khẩn cấp hoặc bị gắn cờ review.</p>
            </header>

            <div className="card-box">
              <div className="table-responsive">
                <table className="admin-table-custom">
                  <thead>
                    <tr>
                      <th>ID Phiên</th>
                      <th>Nội dung tư vấn</th>
                      <th>Ngày kích hoạt</th>
                      <th>Nguy cơ</th>
                      <th>Lý do gắn cờ</th>
                      <th>Xem lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safetyLogs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center-muted">Không có trường hợp khẩn cấp hoặc gắn cờ nào cần review.</td>
                      </tr>
                    ) : (
                      safetyLogs.map(log => (
                        <tr key={log.id} className={log.urgency === 'emergency' ? 'row-emergency-light' : ''}>
                          <td className="font-mono text-sm">{log.id.slice(0, 8)}...</td>
                          <td>
                            <strong>{log.title}</strong>
                            <p className="text-xs text-muted limit-chars">{log.messages[0]?.content.slice(0, 80)}...</p>
                          </td>
                          <td>{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                          <td>{renderUrgencyBadge(log.urgency)}</td>
                          <td>
                            {log.flagged ? (
                              <span className="text-danger font-semibold">{log.flaggedReason}</span>
                            ) : (
                              <span className="text-muted text-xs">Cảnh báo tự động</span>
                            )}
                          </td>
                          <td>
                            <button className="btn-table-action blue" onClick={() => handleViewDetails(log.id)}>Xem &amp; Phân tích</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USERS (QUẢN LÝ THÀNH VIÊN) */}
        {activeTab === 'users' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Quản Lý Thành Viên</h1>
              <p>Phân quyền quản trị và điều chỉnh gói cước thành viên.</p>
            </header>

            <div className="filters-bar card-box mb-4">
              <div className="search-input-wrapper w-full">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Tìm kiếm thành viên theo email hoặc tên..."
                  value={searchUser}
                  onChange={e => { setSearchUser(e.target.value); setUserPage(1); }}
                />
              </div>
            </div>

            <div className="card-box">
              <div className="table-responsive">
                <table className="admin-table-custom">
                  <thead>
                    <tr>
                      <th>Tên thành viên</th>
                      <th>Email</th>
                      <th>Gói cước</th>
                      <th>Quyền hạn</th>
                      <th>Token đã dùng</th>
                      <th>Ngày tham gia</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.email}</td>
                        <td>
                          {editingUserId === u.id ? (
                            <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="select-table-edit">
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                            </select>
                          ) : (
                            <span className={`plan-pill plan-${u.planId}`}>{u.planId}</span>
                          )}
                        </td>
                        <td>
                          {editingUserId === u.id ? (
                            <select value={editRole} onChange={e => setEditRole(e.target.value)} className="select-table-edit">
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="font-semibold text-xs uppercase">{u.role}</span>
                          )}
                        </td>
                        <td className="font-mono text-sm">{u.tokensUsed?.toLocaleString('vi-VN') || 0}</td>
                        <td>{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <div className="actions-cell">
                            {editingUserId === u.id ? (
                              <>
                                <button className="btn-table-action green" onClick={() => handleSaveUserEdit(u.id)}>Lưu</button>
                                <button className="btn-table-action gray" onClick={() => setEditingUserId(null)}>Hủy</button>
                              </>
                            ) : (
                              <>
                                <button className="btn-table-action blue" onClick={() => {
                                  setEditingUserId(u.id)
                                  setEditPlan(u.planId)
                                  setEditRole(u.role)
                                }}>Sửa</button>
                                <button className="btn-table-action blue-soft" onClick={() => handleResetTokens(u.id)}>Reset Token</button>
                                <button className="btn-table-action danger" onClick={() => handleDeleteUser(u.id)}>Xóa</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalUserPages > 1 && (
                <div className="pagination-bar mt-4">
                  <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}>← Trước</button>
                  <span>Trang {userPage} / {totalUserPages}</span>
                  <button disabled={userPage === totalUserPages} onClick={() => setUserPage(p => p + 1)}>Sau →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: OPS & PERFORMANCE */}
        {activeTab === 'ops' && opsLogs && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Giám Sát Vận Hành &amp; Chi Phí</h1>
              <p>Theo dõi uptime, chi phí sử dụng API LLM và lịch sử lỗi hệ thống.</p>
            </header>

            {/* Overview stats for ops */}
            <div className="overview-cards">
              <div className="overview-card">
                <span className="card-label">Uptime Bot</span>
                <h2 className="text-success-custom">{opsLogs.uptime}</h2>
                <div className="card-trend text-success-custom">Vận hành liên tục</div>
              </div>
              <div className="overview-card">
                <span className="card-label">Tần suất lỗi hệ thống (Tháng)</span>
                <h2 className={opsLogs.errors.length > 0 ? 'text-danger-custom' : 'text-success-custom'}>
                  {opsLogs.errors.length} lỗi
                </h2>
                <div className="card-trend">Lỗi mạng &amp; timeout API</div>
              </div>
            </div>

            {/* Line chart mock for cost */}
            <div className="card-box mt-6">
              <h3>Thống kê chi phí API LLM &amp; Tokens tích lũy</h3>
              <p className="chart-subtitle">Ghi nhận mức độ tiêu thụ của mô hình AI theo thời gian</p>
              
              <div className="costs-chart-custom mt-4">
                {opsLogs.costs.map((c, idx) => {
                  const maxCost = Math.max(...opsLogs.costs.map(x => x.totalCost)) || 0.5
                  const heightPercent = Math.max(10, Math.round((c.totalCost / maxCost) * 100))
                  return (
                    <div className="cost-chart-col" key={idx}>
                      <div className="chart-bar-wrapper">
                        <div className="chart-bar-fill" style={{ height: `${heightPercent}%` }} title={`Doanh thu: $${c.totalCost.toFixed(3)}`} />
                      </div>
                      <span className="col-label-date">{c._id.slice(-5)}</span>
                      <span className="col-label-cost">${c.totalCost.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Errors logs list */}
            <div className="card-box mt-6">
              <h3>Nhật ký lỗi hệ thống gần nhất</h3>
              <p className="chart-subtitle">Tự động phát hiện lỗi ngắt quãng hoặc lỗi gọi API LLM/UMLS</p>
              
              <div className="table-responsive mt-4">
                <table className="admin-table-custom">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Lỗi xảy ra</th>
                      <th>Môi trường/Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsLogs.errors.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center-muted">Hệ thống ghi nhận không có lỗi nào xảy ra gần đây.</td>
                      </tr>
                    ) : (
                      opsLogs.errors.map(err => (
                        <tr key={err.id}>
                          <td>{new Date(err.createdAt).toLocaleString('vi-VN')}</td>
                          <td>
                            <strong className="text-danger-custom">{err.message}</strong>
                            <p className="text-xs text-muted font-mono whitespace-pre-wrap mt-1">{err.meta?.error}</p>
                          </td>
                          <td>
                            <span className="text-xs font-semibold">Specialty: {err.meta?.specialtyId}</span>
                            <br />
                            <span className="text-xs text-muted">User: {err.meta?.userId}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENTS & REVENUE (THANH TOÁN & DOANH THU) */}
        {activeTab === 'payments' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Quản Lý Giao Dịch &amp; Doanh Thu</h1>
              <p>Danh sách toàn bộ các hóa đơn nâng cấp và gia hạn định kỳ (Auto-billing) trên hệ thống.</p>
            </header>

            {/* Filters bar */}
            <div className="filters-bar card-box mb-4">
              <div className="filter-title">
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 650 }}>Bộ lọc giao dịch</h3>
              </div>
              <div className="filter-dropdowns">
                <select value={filterPayStatus} onChange={e => { setFilterPayStatus(e.target.value); setPayPage(1); }}>
                  <option value="">-- Trạng thái --</option>
                  <option value="success">Thành công</option>
                  <option value="failed">Thất bại</option>
                  <option value="pending">Chờ thanh toán</option>
                </select>

                <select value={filterPayGateway} onChange={e => { setFilterPayGateway(e.target.value); setPayPage(1); }}>
                  <option value="">-- Cổng thanh toán --</option>
                  <option value="stripe">Stripe (Thẻ Visa/Mastercard)</option>
                  <option value="momo">Ví MoMo</option>
                </select>
              </div>
            </div>

            {/* Transaction log table */}
            <div className="card-box">
              <div className="table-responsive">
                <table className="admin-table-custom">
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Khách hàng</th>
                      <th>Gói cước</th>
                      <th>Cổng thanh toán</th>
                      <th>Loại</th>
                      <th>Số tiền</th>
                      <th>Thời gian</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center-muted">Không tìm thấy giao dịch nào.</td>
                      </tr>
                    ) : (
                      payments.map(p => (
                        <tr key={p.id}>
                          <td className="font-mono text-sm">{p.id.slice(0, 10)}...</td>
                          <td>
                            <strong>{p.user?.name || 'Người dùng'}</strong>
                            <br />
                            <span className="text-xs text-muted">{p.user?.email || 'N/A'}</span>
                          </td>
                          <td><span className="plan-pill plan-pro">{p.planId}</span></td>
                          <td>
                            <span className={`gateway-pill gateway-${p.paymentGateway}`}>
                              {p.paymentGateway === 'stripe' ? '💳 Stripe (Visa/MC)' : '💗 Ví MoMo'}
                            </span>
                          </td>
                          <td>
                            {p.type === 'recurring' ? (
                              <span className="type-badge-recurring">Gia hạn tự động</span>
                            ) : (
                              <span className="type-badge-initial">Nâng cấp lần đầu</span>
                            )}
                          </td>
                          <td className="font-bold text-success-custom">
                            {(p.amount || 0).toLocaleString('vi-VN')} đ
                          </td>
                          <td>{new Date(p.createdAt).toLocaleString('vi-VN')}</td>
                          <td>
                            {p.status === 'success' && <span className="badge-status badge-success">Thành công</span>}
                            {p.status === 'failed' && <span className="badge-status badge-failed">Thất bại</span>}
                            {p.status === 'pending' && <span className="badge-status badge-pending">Chờ xử lý</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPayPages > 1 && (
                <div className="pagination-bar mt-4">
                  <button disabled={payPage === 1} onClick={() => setPayPage(p => p - 1)}>← Trước</button>
                  <span>Trang {payPage} / {totalPayPages}</span>
                  <button disabled={payPage === totalPayPages} onClick={() => setPayPage(p => p + 1)}>Sau →</button>
                </div>
              )}
            </div>

            {/* Export payments report */}
            <div className="card-box mt-6 block-reports">
              <h3>Xuất báo cáo tài chính</h3>
              <p className="chart-subtitle">Tải toàn bộ lịch sử hóa đơn để phục vụ báo cáo kế toán và đối soát.</p>
              <div className="flex-buttons mt-4">
                <button className="btn-report-dl blue" onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payments, null, 2))
                  const downloadAnchor = document.createElement('a')
                  downloadAnchor.setAttribute("href", dataStr)
                  downloadAnchor.setAttribute("download", `MedChat_Financial_Transactions_Report.json`)
                  document.body.appendChild(downloadAnchor)
                  downloadAnchor.click()
                  downloadAnchor.remove()
                }}>Xuất báo cáo giao dịch (JSON)</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL XEM CHI TIẾT HỘI THOẠI & AUDIT */}
      {showDetailModal && selectedConv && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="audit-detail-modal card-glass" onClick={e => e.stopPropagation()}>
            <header className="modal-header-custom">
              <div>
                <h2>{selectedConv.title}</h2>
                <p className="text-xs text-muted">ID: {selectedConv.id} | Ngày khởi tạo: {new Date(selectedConv.createdAt).toLocaleString('vi-VN')}</p>
              </div>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
            </header>

            <div className="audit-detail-body mt-4">
              <div className="flex-meta-header">
                <div><strong>Ngôn ngữ:</strong> <span className="uppercase">{selectedConv.lang}</span></div>
                <div><strong>Người dùng:</strong> {selectedConv.isGuest ? 'Guest (Vãng lai)' : 'Thành viên'}</div>
                <div><strong>Mức độ nguy cơ:</strong> {renderUrgencyBadge(selectedConv.urgency)}</div>
                {selectedConv.flagged && (
                  <div className="flagged-banner">
                    🚩 **Cần Review:** {selectedConv.flaggedReason}
                  </div>
                )}
              </div>

              {/* Chat Timeline history */}
              <div className="audit-timeline mt-4">
                {selectedConv.messages.map((m, idx) => (
                  <div className={`timeline-bubble bubble-${m.role}`} key={idx}>
                    <div className="bubble-header-label">
                      <strong>{m.role === 'user' ? 'Người bệnh (User)' : 'Bác sĩ ảo MedChat'}</strong>
                      <span className="text-xs text-muted">{new Date(m.createdAt || selectedConv.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="bubble-text-content">{m.content}</div>
                  </div>
                ))}
              </div>

              {/* Actions panel for audit */}
              <div className="audit-actions-panel mt-6">
                {!showFlagInput ? (
                  <div className="flex-actions-row">
                    <button className={`btn-audit ${selectedConv.flagged ? 'btn-unflag' : 'btn-flag'}`} onClick={() => {
                      if (selectedConv.flagged) {
                        handleToggleFlag()
                      } else {
                        setShowFlagInput(true)
                      }
                    }}>
                      {selectedConv.flagged ? '🚩 Gỡ cờ review' : '🚩 Đánh dấu cần review'}
                    </button>
                    <button className="btn-audit btn-export-json" onClick={() => handleExportAudit(selectedConv)}>
                      Xuất File kiểm toán (JSON)
                    </button>
                  </div>
                ) : (
                  <div className="flag-input-group card-box">
                    <h4>Nhập lý do cần review hội thoại</h4>
                    <textarea 
                      value={flagReason} 
                      onChange={e => setFlagReason(e.target.value)} 
                      placeholder="Ví dụ: Bot bỏ sót cảnh báo đau ngực dữ dội, chẩn đoán sai triệu chứng nhi..."
                      rows="2"
                    />
                    <div className="flag-buttons mt-2">
                      <button className="btn-table-action green" onClick={handleToggleFlag}>Lưu cờ</button>
                      <button className="btn-table-action gray" onClick={() => setShowFlagInput(false)}>Hủy</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
