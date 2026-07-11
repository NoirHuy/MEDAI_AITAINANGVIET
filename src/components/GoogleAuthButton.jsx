import { useEffect, useRef } from 'react'
import { GOOGLE_CLIENT_ID } from '../utils/googleAuthConfig'

const SCRIPT_ID = 'google-identity-services'

function loadGsiScript(onReady) {
  if (window.google?.accounts?.id) {
    onReady()
    return
  }
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    existing.addEventListener('load', onReady, { once: true })
    return
  }
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.addEventListener('load', onReady, { once: true })
  document.head.appendChild(script)
}

// Renders Google's own "Sign in with Google" button via Google Identity
// Services. On success it hands the caller a signed ID token (JWT) — the
// backend verifies that token server-side (see
// back_end/src/services/googleAuthService.js) rather than trusting
// anything from the client.
export default function GoogleAuthButton({ onCredential }) {
  const containerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    loadGsiScript(() => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 360,
        locale: 'vi',
      })
    })

    return () => {
      cancelled = true
    }
  }, [onCredential])

  return <div ref={containerRef} className="google-auth-button" />
}
