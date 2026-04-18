import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

function navClass({ isActive }) {
  return ['nav-link rounded-pill px-3', isActive ? 'active' : ''].filter(Boolean).join(' ')
}

export function Layout() {
  const { user, logout, loading } = useAuth()
  const { cartCount } = useCart()
  const location = useLocation()

  const cartControl =
    location.pathname === '/' ? (
      <a
        href="#cart-panel"
        className="btn btn-cart-spotify btn-sm rounded-pill d-inline-flex align-items-center justify-content-center gap-2 px-3"
      >
        Cart
        <span className="badge rounded-pill">{cartCount}</span>
      </a>
    ) : (
      <Link
        to="/#cart-panel"
        className="btn btn-cart-spotify btn-sm rounded-pill d-inline-flex align-items-center justify-content-center gap-2 px-3"
      >
        Cart
        <span className="badge rounded-pill">{cartCount}</span>
      </Link>
    )

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark navbar-spotify sticky-top">
        <div className="container-fluid px-3 px-lg-4">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <span className="brand-dot" aria-hidden="true" />
            Modern Shop
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarMain"
            aria-controls="navbarMain"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="navbarMain">
            <ul className="navbar-nav me-auto mb-3 mb-lg-0 align-items-lg-center gap-lg-1 py-lg-0 py-2">
              <li className="nav-item">
                <NavLink className={navClass} to="/" end>
                  Shop
                </NavLink>
              </li>
              {user && (
                <>
                  <li className="nav-item">
                    <NavLink className={navClass} to="/orders">
                      Orders
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink className={navClass} to="/profile">
                      Profile
                    </NavLink>
                  </li>
                  {user.role === 'admin' && (
                    <li className="nav-item">
                      <NavLink className={navClass} to="/admin">
                        Admin
                      </NavLink>
                    </li>
                  )}
                </>
              )}
            </ul>

            <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2 gap-lg-3 ms-lg-auto pb-3 pb-lg-0">
              <div className="d-flex align-items-center gap-2 order-lg-0 order-1">{cartControl}</div>

              {!user && !loading && (
                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 order-lg-1 order-0">
                  <Link
                    to="/login"
                    className="btn btn-link text-decoration-none text-secondary py-2 px-lg-3 text-center text-lg-start link-light link-opacity-75 link-opacity-100-hover"
                  >
                    Log in
                  </Link>
                  <Link to="/register" className="btn btn-spotify rounded-pill px-4 py-2 fw-bold text-center">
                    Sign up free
                  </Link>
                </div>
              )}

              {user && (
                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-wrap justify-content-lg-end">
                  <Link
                    to="/profile"
                    className="navbar-profile-chip d-inline-flex align-items-center gap-2 text-decoration-none text-white order-sm-0"
                    title={`${user.name} — View profile`}
                  >
                    {user.picture ? (
                      <img src={user.picture} alt="" className="navbar-profile-img rounded-circle" width={34} height={34} />
                    ) : (
                      <span className="navbar-profile-initial" aria-hidden="true">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="navbar-profile-name text-truncate">{user.name || user.email}</span>
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline-spotify rounded-pill px-4 py-2 order-sm-1"
                    onClick={() => logout()}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="app-main">
        <Outlet />
      </div>
    </>
  )
}
