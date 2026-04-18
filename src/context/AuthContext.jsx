import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setStoredToken } from '../api'
import { logoutGoogleSession } from '../googleAuth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      setStoredToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('modern_shop_jwt')
    if (!token) {
      setLoading(false)
      return
    }
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email, password) => {
    const { token, user: next } = await api.login({ email, password })
    setStoredToken(token)
    setUser(next)
    return next
  }, [])

  const register = useCallback(async (email, password, name) => {
    const { token, user: next } = await api.register({ email, password, name })
    setStoredToken(token)
    setUser(next)
    return next
  }, [])

  const loginWithGoogleAccessToken = useCallback(async (accessToken) => {
    const { token, user: next } = await api.googleLogin(accessToken)
    setStoredToken(token)
    setUser(next)
    return next
  }, [])

  const updateProfile = useCallback(async (name) => {
    const next = await api.updateProfile({ name })
    setUser(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    setStoredToken(null)
    setUser(null)
    await logoutGoogleSession()
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      loginWithGoogleAccessToken,
      updateProfile,
      logout,
      refreshUser,
      isAdmin: user?.role === 'admin',
    }),
    [user, loading, login, register, loginWithGoogleAccessToken, updateProfile, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
