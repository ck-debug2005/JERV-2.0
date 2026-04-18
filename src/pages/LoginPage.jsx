import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginWithGoogle } from '../googleAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loginWithGoogleAccessToken } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const onGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      const accessToken = await loginWithGoogle()
      await loginWithGoogleAccessToken(accessToken)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Google login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-fluid px-0 flex-grow-1 d-flex flex-column">
      <div className="row g-0 auth-split flex-grow-1">
        <div className="col-lg-7 d-none d-lg-flex auth-split-brand">
          <div className="auth-split-brand-inner text-center text-lg-start">
            <p className="text-uppercase small fw-bold mb-3" style={{ letterSpacing: '0.2em', opacity: 0.85 }}>
              Modern Shop
            </p>
            <h1 className="display-3 mb-4">Soundtrack your style.</h1>
            <p className="lead text-white-50 mb-0">
              A bold, Spotify-inspired experience — dark mode, green energy, and checkout that keeps the
              beat.
            </p>
            <div className="auth-wave justify-content-center justify-content-lg-start" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="col-lg-5 col-12 auth-split-form d-flex align-items-center justify-content-center py-5 py-lg-0">
          <div className="auth-form-panel">
            <h2 className="fw-bold mb-1">Log in</h2>
            <p className="text-secondary small mb-4">Welcome back — sign in to keep shopping.</p>

            <form onSubmit={onSubmit}>
            <div className="form-floating mb-3">
              <input
                type="email"
                className="form-control"
                id="loginEmail"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <label htmlFor="loginEmail">Email</label>
            </div>
            <div className="form-floating mb-3">
              <input
                type="password"
                className="form-control"
                id="loginPassword"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <label htmlFor="loginPassword">Password</label>
            </div>
            {error && (
              <div className="alert alert-danger border-0 py-2 small mb-3" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-spotify w-100 rounded-pill py-3 fw-bold" disabled={busy}>
              {busy ? 'Please wait…' : 'Continue'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="btn btn-outline-light w-100 rounded-pill py-3 d-inline-flex align-items-center justify-content-center gap-2 fw-semibold border-secondary"
            onClick={onGoogle}
            disabled={busy}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

            <p className="text-center small text-secondary mt-4 mb-0">
              No account?{' '}
              <Link to="/register" className="text-white fw-semibold">
                Sign up for Modern Shop
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
