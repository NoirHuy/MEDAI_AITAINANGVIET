import { useCallback, useEffect, useState } from 'react'

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

export function useAccount() {
  const [account, setAccount] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    apiRequest('/api/auth/me')
      .then(({ user }) => {
        if (!cancelled) setAccount(user)
      })
      .catch(() => {
        if (!cancelled) setAccount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signUpForm = useCallback(async ({ name, email, password }) => {
    const { user } = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setAccount(user)
    return user
  }, [])

  const signInForm = useCallback(async ({ email, password }) => {
    const { user } = await apiRequest('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setAccount(user)
    return user
  }, [])

  const signInWithGoogle = useCallback(async (payload) => {
    const { user } = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setAccount(user)
    return user
  }, [])

  const updateName = useCallback(async (name) => {
    const { user } = await apiRequest('/api/account/name', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    setAccount(user)
    return user
  }, [])

  const changePassword = useCallback(async ({ oldPassword, newPassword }) => {
    return await apiRequest('/api/account/password', {
      method: 'PATCH',
      body: JSON.stringify({ oldPassword, newPassword }),
    })
  }, [])

  const updateCard = useCallback(async (cardData) => {
    const { user } = await apiRequest('/api/account/card', {
      method: 'PATCH',
      body: JSON.stringify(cardData),
    })
    setAccount(user)
    return user
  }, [])

  const deleteCard = useCallback(async () => {
    const { user } = await apiRequest('/api/account/card', {
      method: 'DELETE',
    })
    setAccount(user)
    return user
  }, [])

  const toggleAutoRenew = useCallback(async (autoRenew) => {
    const { user } = await apiRequest('/api/account/autorenew', {
      method: 'PATCH',
      body: JSON.stringify({ autoRenew }),
    })
    setAccount(user)
    return user
  }, [])

  const setPlan = useCallback(async (planId) => {
    const { user } = await apiRequest('/api/account/plan', {
      method: 'PATCH',
      body: JSON.stringify({ planId }),
    })
    setAccount(user)
    return user
  }, [])

  const signOut = useCallback(async () => {
    await apiRequest('/api/auth/signout', { method: 'POST' }).catch(() => {})
    setAccount(null)
  }, [])

  const fetchUsage = useCallback(() => apiRequest('/api/account/usage'), [])

  return {
    account,
    signUpForm,
    signInForm,
    signInWithGoogle,
    updateName,
    changePassword,
    updateCard,
    deleteCard,
    toggleAutoRenew,
    setPlan,
    updateAccountUser: (user) => setAccount(user),
    signOut,
    fetchUsage,
  }
}
