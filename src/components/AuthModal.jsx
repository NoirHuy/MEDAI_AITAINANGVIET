import { useState, useEffect } from 'react'
import {
  CloseIcon,
  GoogleIcon,
  EyeIcon,
  EyeOffIcon,
  SpinnerIcon,
  UserCircleIcon,
} from './Icons'
import GoogleAuthButton from './GoogleAuthButton'
import { isGoogleAuthConfigured, setDynamicGoogleClientId, getGoogleClientId } from '../utils/googleAuthConfig'
import { MOCK_GOOGLE_ACCOUNT } from '../data/account'
import './SettingsModal.css'
import './AccountMenu.css'
import './AuthModal.css'

export default function AuthModal({
  initialTab = 'signin',
  onClose,
  onSignUpForm,
  onSignInForm,
  onSignInWithGoogle,
  onAuthed,
}) {
  const [tab, setTab] = useState(initialTab)
  const [googlePicker, setGooglePicker] = useState(false)
  const [customGoogleEmail, setCustomGoogleEmail] = useState('')
  const [showCustomGoogle, setShowCustomGoogle] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [, setForceUpdate] = useState(0)

  useEffect(() => {
    if (!isGoogleAuthConfigured()) {
      fetch('/api/auth/config')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.googleClientId) {
            setDynamicGoogleClientId(data.googleClientId)
            setForceUpdate((n) => n + 1)
          }
        })
        .catch(() => {})
    }
  }, [])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsConsent, setTermsConsent] = useState(false)

  function switchTab(nextTab) {
    setTab(nextTab)
    setError(null)
    setGooglePicker(false)
    setShowCustomGoogle(false)
  }

  async function handleFormSubmit(e) {
    e.preventDefault()
    setError(null)

    if (tab === 'signup' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    if (tab === 'signup' && !termsConsent) {
      setError('Bạn cần đồng ý với Điều khoản & Chính sách bảo mật dữ liệu y tế.')
      return
    }

    setLoading(true)
    try {
      const user =
        tab === 'signup'
          ? await onSignUpForm({ name, email, password })
          : await onSignInForm({ email, password })
      onAuthed(user, tab === 'signup' ? 'Tạo tài khoản thành công!' : 'Đăng nhập thành công!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleChoose(chosenEmail, chosenName) {
    setError(null)
    setLoading(true)
    try {
      const user = await onSignInWithGoogle({ email: chosenEmail, name: chosenName })
      onAuthed(user, 'Đăng nhập bằng Google thành công!')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleGoogleCredential(credential) {
    setError(null)
    setLoading(true)
    try {
      const user = await onSignInWithGoogle({ credential })
      onAuthed(user, 'Đăng nhập bằng Google thành công!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="settings-modal__close" onClick={onClose} aria-label="Đóng">
          <CloseIcon />
        </button>

        <h2 className="auth-modal__title">Chào mừng đến với MedChat247</h2>
        <p className="auth-modal__subtitle">
          Đăng nhập để lưu lịch sử trò chuyện và quản lý gói sử dụng của bạn.
        </p>

        <div className="auth-modal__tabs">
          <button
            className={`auth-modal__tab ${tab === 'signin' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => switchTab('signin')}
          >
            Đăng nhập
          </button>
          <button
            className={`auth-modal__tab ${tab === 'signup' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Đăng ký
          </button>
        </div>

        {googlePicker ? (
          <div className="google-picker">
            <p className="google-picker__hint">Chọn một tài khoản Google (mô phỏng)</p>
            <button
              className="google-picker__account"
              disabled={loading}
              onClick={() => handleGoogleChoose(MOCK_GOOGLE_ACCOUNT.email, MOCK_GOOGLE_ACCOUNT.name)}
            >
              <span className="account-avatar">
                {MOCK_GOOGLE_ACCOUNT.name.charAt(0).toUpperCase()}
              </span>
              <span className="google-picker__account-text">
                <span className="account-menu__name">{MOCK_GOOGLE_ACCOUNT.name}</span>
                <span className="account-menu__email">{MOCK_GOOGLE_ACCOUNT.email}</span>
              </span>
            </button>

            {showCustomGoogle ? (
              <form
                className="google-picker__custom-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!customGoogleEmail.trim()) return
                  handleGoogleChoose(customGoogleEmail.trim())
                }}
              >
                <input
                  type="email"
                  placeholder="tenban@gmail.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading ? <SpinnerIcon /> : 'Tiếp tục'}
                </button>
              </form>
            ) : (
              <button
                className="google-picker__account google-picker__account--ghost"
                onClick={() => setShowCustomGoogle(true)}
              >
                <span className="account-avatar account-avatar--ghost">
                  <UserCircleIcon />
                </span>
                <span className="google-picker__account-text">
                  <span className="account-menu__name">Sử dụng tài khoản Gmail khác</span>
                </span>
              </button>
            )}

            {error && <p className="auth-modal__error">{error}</p>}

            <button
              className="auth-modal__back"
              onClick={() => {
                setGooglePicker(false)
                setError(null)
              }}
            >
              ← Quay lại
            </button>
          </div>
        ) : (
          <>
            {isGoogleAuthConfigured() ? (
              <GoogleAuthButton onCredential={handleGoogleCredential} />
            ) : (
              <button
                className="google-btn"
                onClick={() => {
                  setError(null)
                  if (isGoogleAuthConfigured() && window.google?.accounts?.id) {
                    window.google.accounts.id.initialize({
                      client_id: getGoogleClientId(),
                      callback: (res) => handleGoogleCredential(res.credential),
                    })
                    window.google.accounts.id.prompt()
                  } else {
                    setGooglePicker(true)
                  }
                }}
              >
                <GoogleIcon />
                <span>Tiếp tục với Google</span>
              </button>
            )}

            <div className="auth-modal__divider">
              <span>hoặc</span>
            </div>

            <form className="auth-modal__form" onSubmit={handleFormSubmit}>
              {tab === 'signup' && (
                <label className="settings-field">
                  <span>Họ tên</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </label>
              )}

              <label className="settings-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@vidu.com"
                  required
                />
              </label>

              <label className="settings-field">
                <span>Mật khẩu</span>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="password-input__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              {tab === 'signup' && (
                <>
                  <label className="settings-field">
                    <span>Xác nhận mật khẩu</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      minLength={6}
                      required
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', margin: '10px 0 14px' }}>
                    <input
                      type="checkbox"
                      checked={termsConsent}
                      onChange={(e) => setTermsConsent(e.target.checked)}
                      required
                      style={{ marginTop: '3px', accentColor: 'var(--bg-accent)', width: '16px', height: '16px', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                      Tôi đồng ý với <strong>Điều khoản sử dụng</strong> và <strong>Chính sách bảo mật dữ liệu y tế MedChat247</strong>.
                    </span>
                  </label>
                </>
              )}

              {error && <p className="auth-modal__error">{error}</p>}

              <button className="btn btn--primary auth-modal__submit" disabled={loading}>
                {loading ? (
                  <SpinnerIcon />
                ) : tab === 'signup' ? (
                  'Tạo tài khoản'
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>

            <p className="auth-modal__switch">
              {tab === 'signup' ? (
                <>
                  Đã có tài khoản?{' '}
                  <button onClick={() => switchTab('signin')}>Đăng nhập</button>
                </>
              ) : (
                <>
                  Chưa có tài khoản?{' '}
                  <button onClick={() => switchTab('signup')}>Đăng ký</button>
                </>
              )}
            </p>
          </>
        )}

        <p className="auth-modal__disclaimer">
          Tài khoản và mật khẩu được lưu trên máy chủ backend (mã hoá bcrypt).{' '}
          {isGoogleAuthConfigured()
            ? 'Đăng nhập Google dùng OAuth thật và được máy chủ xác minh.'
            : 'Đăng nhập Google hiện là bản mô phỏng — cấu hình GOOGLE_CLIENT_ID để bật OAuth thật.'}
        </p>
      </div>
    </div>
  )
}
