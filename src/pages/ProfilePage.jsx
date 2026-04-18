import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.name) setName(user.name)
  }, [user])

  if (!user) {
    return (
      <div className="container py-5">
        <div className="alert alert-info shadow-sm">
          <Link to="/login" className="alert-link">
            Log in
          </Link>{' '}
          to manage your profile.
        </div>
      </div>
    )
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await updateProfile(name)
      setMessage('Profile updated.')
    } catch (err) {
      setError(err.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h1 className="h3 fw-bold mb-4">Your profile</h1>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body d-flex flex-column flex-sm-row gap-3 align-items-sm-center">
              {user.picture ? (
                <img src={user.picture} alt="" className="rounded-circle border" width={72} height={72} />
              ) : (
                <div
                  className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold fs-4 border border-primary border-opacity-25"
                  style={{ width: 72, height: 72 }}
                  aria-hidden="true"
                >
                  {user.name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <p className="mb-1">
                  <span className="text-secondary small me-2">Email</span>
                  <span className="fw-semibold">{user.email}</span>
                </p>
                <p className="mb-0">
                  <span className="text-secondary small me-2">Role</span>
                  <span className={`badge ${user.role === 'admin' ? 'text-bg-danger' : 'text-bg-primary'}`}>
                    {user.role}
                  </span>
                </p>
                {user.googleLinked && (
                  <p className="small text-success mb-0 mt-2">Google account linked.</p>
                )}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 fw-semibold mb-3">Update display name</h2>
              <form onSubmit={onSubmit}>
                <div className="mb-3">
                  <label htmlFor="profileName" className="form-label">
                    Display name
                  </label>
                  <input
                    id="profileName"
                    type="text"
                    className="form-control form-control-lg"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="alert alert-danger py-2 small" role="alert">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="alert alert-success py-2 small" role="alert">
                    {message}
                  </div>
                )}
                <button type="submit" className="btn btn-primary px-4" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
