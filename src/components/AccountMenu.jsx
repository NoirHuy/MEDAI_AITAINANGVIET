import { useEffect, useRef, useState } from 'react'
import {
  UserCircleIcon,
  GaugeIcon,
  CreditCardIcon,
  SunIcon,
  MoonIcon,
  HelpCircleIcon,
  LogOutIcon,
  ChevronRightIcon,
  CheckIcon,
} from './Icons'
import { getPlan } from '../data/account'
import './AccountMenu.css'

export default function AccountMenu({
  collapsed,
  account,
  theme,
  onToggleTheme,
  onOpenDashboard,
  onSignOut,
  onHelp,
}) {
  const [open, setOpen] = useState(false)
  const [appearanceExpanded, setAppearanceExpanded] = useState(false)
  const ref = useRef(null)
  const plan = getPlan(account.planId)
  const initial = account.name.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setAppearanceExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function openDashboardTab(tab) {
    let mapped = 'account'
    if (tab === 'usage') mapped = 'invoices'
    if (tab === 'subscription') mapped = 'billing'
    onOpenDashboard(mapped)
    setOpen(false)
    setAppearanceExpanded(false)
  }

  return (
    <div className="account-menu" ref={ref}>
      {open && (
        <div className="account-menu__popover" role="menu">
          <div className="account-menu__header">
            <span className="account-avatar account-avatar--lg">{initial}</span>
            <span className="account-menu__header-text">
              <span className="account-menu__name">{account.name}</span>
              <span className="account-menu__email">{account.email}</span>
            </span>
          </div>

          <div className="account-menu__divider" />

          <button className="account-menu__item" onClick={() => openDashboardTab('account')}>
            <UserCircleIcon />
            <span>Hồ sơ tài khoản</span>
          </button>

          <button className="account-menu__item" onClick={() => openDashboardTab('usage')}>
            <GaugeIcon />
            <span>Mức sử dụng &amp; Token</span>
          </button>

          <button className="account-menu__item" onClick={() => openDashboardTab('subscription')}>
            <CreditCardIcon />
            <span>Gói thuê bao</span>
            <span className="account-menu__badge">{plan.name}</span>
          </button>

          <div className="account-menu__divider" />

          <button
            className="account-menu__item"
            onClick={() => setAppearanceExpanded((v) => !v)}
          >
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            <span>Giao diện</span>
            <ChevronRightIcon
              className={`account-menu__chevron ${appearanceExpanded ? 'account-menu__chevron--open' : ''}`}
            />
          </button>
          {appearanceExpanded && (
            <div className="account-menu__submenu">
              <button
                className="account-menu__item account-menu__item--sub"
                onClick={() => theme === 'dark' && onToggleTheme()}
              >
                <SunIcon />
                <span>Sáng</span>
                {theme === 'light' && <CheckIcon className="account-menu__check" />}
              </button>
              <button
                className="account-menu__item account-menu__item--sub"
                onClick={() => theme === 'light' && onToggleTheme()}
              >
                <MoonIcon />
                <span>Tối</span>
                {theme === 'dark' && <CheckIcon className="account-menu__check" />}
              </button>
            </div>
          )}

          <button
            className="account-menu__item"
            onClick={() => {
              onHelp()
              setOpen(false)
            }}
          >
            <HelpCircleIcon />
            <span>Trợ giúp &amp; phản hồi</span>
          </button>

          <div className="account-menu__divider" />

          <button
            className="account-menu__item account-menu__item--danger"
            onClick={() => {
              onSignOut()
              setOpen(false)
            }}
          >
            <LogOutIcon />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}

      <button
        className={`account-menu__trigger ${collapsed ? 'account-menu__trigger--collapsed' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="account-avatar">{initial}</span>
        {!collapsed && (
          <span className="account-menu__trigger-text">
            <span className="account-menu__name">{account.name}</span>
            <span className="account-menu__email">{account.email}</span>
          </span>
        )}
      </button>
    </div>
  )
}
