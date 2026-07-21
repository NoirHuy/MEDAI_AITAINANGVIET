import { MenuIcon, PlusIcon, SearchIcon, TrashIcon, PulseIcon, LogInIcon } from './Icons'
import AccountMenu from './AccountMenu'
import './Sidebar.css'

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  theme,
  onToggleTheme,
  searchTerm,
  onSearchTermChange,
  account,
  onOpenSettings,
  onSignOut,
  onHelp,
  onOpenAuth,
  lang = 'vi',
}) {
  const isEn = lang === 'en'
  const filtered = searchTerm
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : conversations

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__top">
        <button
          className="icon-btn"
          onClick={onToggleCollapsed}
          title={collapsed ? (isEn ? 'Expand menu' : 'Mở rộng menu') : (isEn ? 'Collapse menu' : 'Thu gọn menu')}
          aria-label="Toggle sidebar"
        >
          <MenuIcon />
        </button>
        {!collapsed && (
          <span className="sidebar__brand">
            <PulseIcon className="sidebar__brand-icon" />
            MedChat
          </span>
        )}
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <PlusIcon />
        {!collapsed && <span>{isEn ? 'New conversation' : 'Cuộc trò chuyện mới'}</span>}
      </button>

      {!collapsed && (
        <div className="sidebar__search">
          <SearchIcon className="sidebar__search-icon" />
          <input
            type="text"
            placeholder={isEn ? "Search conversations" : "Tìm kiếm cuộc trò chuyện"}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
      )}

      {!collapsed && (
        <nav className="sidebar__history">
          <p className="sidebar__section-label">{isEn ? 'Recent' : 'Gần đây'}</p>
          <ul>
            {filtered.map((conv) => (
              <li key={conv.id}>
                <button
                   className={`history-item ${conv.id === activeId ? 'history-item--active' : ''}`}
                  onClick={() => onSelect(conv.id)}
                  title={conv.title}
                >
                  <span className="history-item__title">{conv.title}</span>
                  <span
                    className="history-item__delete"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conv.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        onDelete(conv.id)
                      }
                    }}
                    aria-label={isEn ? `Delete "${conv.title}"` : `Xóa "${conv.title}"`}
                  >
                    <TrashIcon />
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="sidebar__empty">{isEn ? 'No conversations' : 'Không có cuộc trò chuyện nào'}</li>
            )}
          </ul>
        </nav>
      )}

      <div className="sidebar__bottom">
        {account === undefined ? (
          <div className="sidebar__account-placeholder" />
        ) : account ? (
          <AccountMenu
            collapsed={collapsed}
            account={account}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenDashboard={onOpenSettings}
            onSignOut={onSignOut}
            onHelp={onHelp}
            lang={lang}
          />
        ) : (
          <button
            className={`guest-login-btn ${collapsed ? 'guest-login-btn--collapsed' : ''}`}
            onClick={onOpenAuth}
          >
            <LogInIcon />
            {!collapsed && <span>{isEn ? 'Sign in / Sign up' : 'Đăng nhập / Đăng ký'}</span>}
          </button>
        )}
        {!collapsed && (
          <p className="sidebar__disclaimer">
            {isEn 
              ? "MedChat is for reference only, not a replacement for a doctor's diagnosis."
              : "MedChat chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ."
            }
          </p>
        )}
      </div>
    </aside>
  )
}
