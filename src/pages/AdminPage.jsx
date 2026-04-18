import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const ORDER_STATUSES = ['placed', 'processing', 'shipped', 'cancelled']

function formatMoney(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(x)
}

export function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('dashboard')

  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /** Categories */
  const [newCatName, setNewCatName] = useState('')
  const [editCatId, setEditCatId] = useState(null)
  const [editCatName, setEditCatName] = useState('')

  /** Products modal */
  const [productModal, setProductModal] = useState(null)

  /** Users inline */
  const [editUserId, setEditUserId] = useState(null)
  const [editUserName, setEditUserName] = useState('')
  const [editUserRole, setEditUserRole] = useState('user')

  /** Order detail modal */
  const [orderDetailId, setOrderDetailId] = useState(null)
  const [orderDetail, setOrderDetail] = useState(null)

  const clearError = () => setError(null)

  const loadStats = useCallback(async () => {
    const s = await api.adminStats()
    setStats(s)
  }, [])

  const loadCategories = useCallback(async () => {
    const rows = await api.getCategories()
    setCategories(rows)
  }, [])

  const loadProducts = useCallback(async () => {
    const rows = await api.getProducts()
    setProducts(rows)
  }, [])

  const loadUsers = useCallback(async () => {
    const rows = await api.adminGetUsers()
    setUsers(rows)
  }, [])

  const loadOrders = useCallback(async () => {
    const rows = await api.adminGetOrders()
    setOrders(rows)
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStats(), loadCategories(), loadProducts(), loadUsers(), loadOrders()])
  }, [loadStats, loadCategories, loadProducts, loadUsers, loadOrders])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    clearError()
    setBusy(true)
    refreshAll()
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setBusy(false))
  }, [user, refreshAll])

  useEffect(() => {
    if (!orderDetailId) {
      setOrderDetail(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const o = await api.adminGetOrder(orderDetailId)
        if (!cancelled) setOrderDetail(o)
      } catch (e) {
        if (!cancelled) setError(e.message || String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderDetailId])

  const run = async (fn) => {
    clearError()
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const onCreateCategory = (e) => {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    run(async () => {
      await api.adminCreateCategory({ name })
      setNewCatName('')
      await Promise.all([loadCategories(), loadStats()])
    })
  }

  const startEditCat = (c) => {
    setEditCatId(c.id)
    setEditCatName(c.name)
  }

  const saveEditCat = () => {
    const name = editCatName.trim()
    if (!editCatId || !name) return
    run(async () => {
      await api.adminUpdateCategory(editCatId, { name })
      setEditCatId(null)
      await Promise.all([loadCategories(), loadProducts(), loadStats()])
    })
  }

  const deleteCat = (c) => {
    if (!window.confirm(`Delete category “${c.name}”?`)) return
    run(async () => {
      await api.adminDeleteCategory(c.id)
      await Promise.all([loadCategories(), loadProducts(), loadStats()])
    })
  }

  const openProductModal = (p) => {
    if (p) {
      setProductModal({
        id: p.id,
        categoryId: p.category_id,
        name: p.name,
        description: p.description || '',
        price: String(p.price),
        imageUrl: p.image || '',
      })
    } else {
      const first = categories[0]
      setProductModal({
        id: null,
        categoryId: first?.id ?? '',
        name: '',
        description: '',
        price: '',
        imageUrl: '',
      })
    }
  }

  const saveProduct = (e) => {
    e.preventDefault()
    if (!productModal) return
    const { id, categoryId, name, description, price, imageUrl } = productModal
    const payload = {
      categoryId: Number(categoryId),
      name: name.trim(),
      description,
      price: Number(price),
      imageUrl: imageUrl.trim(),
    }
    run(async () => {
      if (id) {
        await api.adminUpdateProduct(id, payload)
      } else {
        await api.adminCreateProduct(payload)
      }
      setProductModal(null)
      await Promise.all([loadProducts(), loadStats()])
    })
  }

  const deleteProduct = (p) => {
    if (!window.confirm(`Delete product “${p.name}”?`)) return
    run(async () => {
      await api.adminDeleteProduct(p.id)
      await Promise.all([loadProducts(), loadStats()])
    })
  }

  const startEditUser = (u) => {
    setEditUserId(u.id)
    setEditUserName(u.name || '')
    setEditUserRole(u.role)
  }

  const saveUser = () => {
    if (!editUserId) return
    run(async () => {
      await api.adminUpdateUser(editUserId, {
        name: editUserName.trim(),
        role: editUserRole,
      })
      setEditUserId(null)
      await Promise.all([loadUsers(), loadStats()])
    })
  }

  const deleteUser = (u) => {
    if (!window.confirm(`Delete user ${u.email}? This cannot be undone.`)) return
    run(async () => {
      await api.adminDeleteUser(u.id)
      await loadUsers()
    })
  }

  const updateOrderStatus = (orderId, status) => {
    run(async () => {
      await api.adminUpdateOrderStatus(orderId, { status })
      await Promise.all([loadOrders(), loadStats()])
    })
  }

  const tabs = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'categories', label: 'Categories' },
      { id: 'products', label: 'Products' },
      { id: 'users', label: 'Users' },
      { id: 'orders', label: 'Orders' },
    ],
    [],
  )

  if (!user) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning shadow-sm mb-0">
          <Link to="/login" className="alert-link">
            Log in
          </Link>{' '}
          to continue.
        </div>
      </div>
    )
  }

  if (user.role !== 'admin') {
    return (
      <div className="container py-5">
        <div className="alert alert-secondary mb-0">This area is for administrators only.</div>
      </div>
    )
  }

  return (
    <div className="container-fluid px-3 px-lg-4 py-4 admin-dashboard">
      <div className="d-flex flex-column flex-md-row align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Admin</h1>
          <p className="text-secondary mb-0 small">
            Manage catalog, users, and orders. Data is stored in SQLite via the Node API (
            <code className="text-secondary">server/data/modern_shop.sqlite</code>
            ).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-light btn-sm rounded-pill px-3"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await refreshAll()
            })
          }
        >
          Refresh all
        </button>
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={clearError} />
        </div>
      )}

      <ul className="nav nav-pills gap-2 flex-wrap mb-4">
        {tabs.map((t) => (
          <li className="nav-item" key={t.id}>
            <button
              type="button"
              className={`nav-link rounded-pill px-4 ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'dashboard' && (
        <div className="row g-3 g-lg-4">
          {stats ? (
            <>
              <div className="col-6 col-lg">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="text-secondary small text-uppercase fw-semibold">Users</div>
                    <div className="display-6 fw-bold">{stats.users}</div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="text-secondary small text-uppercase fw-semibold">Products</div>
                    <div className="display-6 fw-bold">{stats.products}</div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="text-secondary small text-uppercase fw-semibold">Categories</div>
                    <div className="display-6 fw-bold">{stats.categories}</div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="text-secondary small text-uppercase fw-semibold">Orders</div>
                    <div className="display-6 fw-bold">{stats.orders}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg">
                <div className="card border-0 shadow-sm h-100 border-success border-opacity-25">
                  <div className="card-body">
                    <div className="text-secondary small text-uppercase fw-semibold">Revenue (all orders)</div>
                    <div className="display-6 fw-bold text-success">{formatMoney(stats.revenueTotal)}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="col-12">
              <p className="text-secondary">{busy ? 'Loading…' : 'No stats yet.'}</p>
            </div>
          )}
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h2 className="h6 fw-bold mb-3">Admin capabilities</h2>
                <ul className="list-unstyled mb-0 row g-2">
                  <li className="col-12 col-md-6">
                    <button
                      type="button"
                      className="btn btn-outline-light rounded-pill text-start w-100 py-2 px-3"
                      disabled={busy}
                      onClick={() => setTab('dashboard')}
                    >
                      <span className="fw-semibold d-block">Admin dashboard</span>
                      <span className="small text-secondary">Overview stats and revenue</span>
                    </button>
                  </li>
                  <li className="col-12 col-md-6">
                    <button
                      type="button"
                      className="btn btn-outline-light rounded-pill text-start w-100 py-2 px-3"
                      disabled={busy}
                      onClick={() => setTab('products')}
                    >
                      <span className="fw-semibold d-block">Add / edit / delete products</span>
                      <span className="small text-secondary">Catalog and pricing</span>
                    </button>
                  </li>
                  <li className="col-12 col-md-6">
                    <button
                      type="button"
                      className="btn btn-outline-light rounded-pill text-start w-100 py-2 px-3"
                      disabled={busy}
                      onClick={() => setTab('users')}
                    >
                      <span className="fw-semibold d-block">Manage users</span>
                      <span className="small text-secondary">Names and roles</span>
                    </button>
                  </li>
                  <li className="col-12 col-md-6">
                    <button
                      type="button"
                      className="btn btn-outline-light rounded-pill text-start w-100 py-2 px-3"
                      disabled={busy}
                      onClick={() => setTab('orders')}
                    >
                      <span className="fw-semibold d-block">View orders</span>
                      <span className="small text-secondary">Status and line items</span>
                    </button>
                  </li>
                  <li className="col-12 col-md-6">
                    <button
                      type="button"
                      className="btn btn-outline-light rounded-pill text-start w-100 py-2 px-3"
                      disabled={busy}
                      onClick={() => setTab('categories')}
                    >
                      <span className="fw-semibold d-block">Manage categories</span>
                      <span className="small text-secondary">Create and organize groups</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h2 className="h6 fw-bold mb-2">Seeded login</h2>
                <p className="text-secondary small mb-0">
                  Default admin credentials are in <code>.env.example</code> (<code>ADMIN_EMAIL</code> /{' '}
                  <code>ADMIN_PASSWORD</code>). Use the same values in your <code>.env</code> after the first API
                  start.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="p-3 p-md-4 border-bottom border-secondary border-opacity-25">
              <form className="row g-2 align-items-end" onSubmit={onCreateCategory}>
                <div className="col-md-6 col-lg-4">
                  <label className="form-label small text-secondary mb-1">New category name</label>
                  <input
                    className="form-control bg-dark border-secondary text-white"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Audio"
                  />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-spotify rounded-pill px-4 fw-bold" disabled={busy}>
                    Add
                  </button>
                </div>
              </form>
            </div>
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0 align-middle">
                <thead>
                  <tr className="text-secondary small">
                    <th>ID</th>
                    <th>Name</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>
                        {editCatId === c.id ? (
                          <input
                            className="form-control form-control-sm bg-dark border-secondary text-white"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                          />
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="text-end text-nowrap">
                        {editCatId === c.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-spotify rounded-pill me-1"
                              disabled={busy}
                              onClick={saveEditCat}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-light rounded-pill"
                              disabled={busy}
                              onClick={() => setEditCatId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-light rounded-pill me-1"
                              disabled={busy}
                              onClick={() => startEditCat(c)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger rounded-pill"
                              disabled={busy}
                              onClick={() => deleteCat(c)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-3 p-md-4 border-bottom border-secondary border-opacity-25 d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <h2 className="h6 fw-bold mb-0">Products</h2>
            <button
              type="button"
              className="btn btn-spotify rounded-pill px-4 fw-bold btn-sm"
              disabled={busy || categories.length === 0}
              onClick={() => openProductModal(null)}
            >
              Add product
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-dark table-hover mb-0 align-middle">
              <thead>
                <tr className="text-secondary small">
                  <th>ID</th>
                  <th />
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td style={{ width: 48 }}>
                      {p.image ? (
                        <img src={p.image} alt="" className="rounded" width={40} height={40} style={{ objectFit: 'cover' }} />
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                    <td className="fw-semibold">{p.name}</td>
                    <td>{p.category}</td>
                    <td>{formatMoney(p.price)}</td>
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light rounded-pill me-1"
                        disabled={busy}
                        onClick={() => openProductModal(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-pill"
                        disabled={busy}
                        onClick={() => deleteProduct(p)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-dark table-hover mb-0 align-middle">
              <thead>
                <tr className="text-secondary small">
                  <th>ID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td className="text-break">{u.email}</td>
                    <td>
                      {editUserId === u.id ? (
                        <input
                          className="form-control form-control-sm bg-dark border-secondary text-white"
                          value={editUserName}
                          onChange={(e) => setEditUserName(e.target.value)}
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td>
                      {editUserId === u.id ? (
                        <select
                          className="form-select form-select-sm bg-dark border-secondary text-white"
                          value={editUserRole}
                          onChange={(e) => setEditUserRole(e.target.value)}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span className={u.role === 'admin' ? 'text-success fw-semibold' : ''}>{u.role}</span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      {editUserId === u.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-spotify rounded-pill me-1"
                            disabled={busy}
                            onClick={saveUser}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-light rounded-pill"
                            disabled={busy}
                            onClick={() => setEditUserId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-light rounded-pill me-1"
                            disabled={busy}
                            onClick={() => startEditUser(u)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill"
                            disabled={busy || u.id === user.id}
                            title={u.id === user.id ? 'Cannot delete yourself' : undefined}
                            onClick={() => deleteUser(u)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-dark table-hover mb-0 align-middle">
              <thead>
                <tr className="text-secondary small">
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>
                      <div className="small">{o.userEmail}</div>
                      <div className="text-secondary small">{o.userName}</div>
                    </td>
                    <td>{formatMoney(o.total)}</td>
                    <td style={{ minWidth: 160 }}>
                      <select
                        className="form-select form-select-sm bg-dark border-secondary text-white"
                        value={o.status}
                        disabled={busy}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-secondary small text-nowrap">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light rounded-pill"
                        onClick={() => setOrderDetailId(o.id)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product modal */}
      {productModal && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-dark border border-secondary text-white">
              <div className="modal-header border-secondary">
                <h2 className="modal-title h5 fw-bold">{productModal.id ? 'Edit product' : 'New product'}</h2>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setProductModal(null)}
                />
              </div>
              <form onSubmit={saveProduct}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small text-secondary">Category</label>
                      <select
                        className="form-select bg-dark border-secondary text-white"
                        required
                        value={productModal.categoryId}
                        onChange={(e) =>
                          setProductModal((m) => ({ ...m, categoryId: Number(e.target.value) }))
                        }
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small text-secondary">Price (USD)</label>
                      <input
                        className="form-control bg-dark border-secondary text-white"
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={productModal.price}
                        onChange={(e) => setProductModal((m) => ({ ...m, price: e.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small text-secondary">Name</label>
                      <input
                        className="form-control bg-dark border-secondary text-white"
                        required
                        value={productModal.name}
                        onChange={(e) => setProductModal((m) => ({ ...m, name: e.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small text-secondary">Description</label>
                      <textarea
                        className="form-control bg-dark border-secondary text-white"
                        rows={3}
                        value={productModal.description}
                        onChange={(e) => setProductModal((m) => ({ ...m, description: e.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small text-secondary">Image URL</label>
                      <input
                        className="form-control bg-dark border-secondary text-white"
                        required
                        placeholder="https://..."
                        value={productModal.imageUrl}
                        onChange={(e) => setProductModal((m) => ({ ...m, imageUrl: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-outline-light rounded-pill" onClick={() => setProductModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-spotify rounded-pill px-4 fw-bold" disabled={busy}>
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {orderDetailId && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-dark border border-secondary text-white">
              <div className="modal-header border-secondary">
                <h2 className="modal-title h5 fw-bold">Order #{orderDetailId}</h2>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setOrderDetailId(null)}
                />
              </div>
              <div className="modal-body">
                {!orderDetail ? (
                  <p className="text-secondary mb-0">Loading…</p>
                ) : (
                  <>
                    <dl className="row small mb-3">
                      <dt className="col-sm-3 text-secondary">Customer</dt>
                      <dd className="col-sm-9">
                        {orderDetail.userEmail} · {orderDetail.userName}
                      </dd>
                      <dt className="col-sm-3 text-secondary">Status</dt>
                      <dd className="col-sm-9">{orderDetail.status}</dd>
                      <dt className="col-sm-3 text-secondary">Subtotal</dt>
                      <dd className="col-sm-9">{formatMoney(orderDetail.subtotal)}</dd>
                      <dt className="col-sm-3 text-secondary">Shipping</dt>
                      <dd className="col-sm-9">{formatMoney(orderDetail.shipping)}</dd>
                      <dt className="col-sm-3 text-secondary">Total</dt>
                      <dd className="col-sm-9 fw-bold">{formatMoney(orderDetail.total)}</dd>
                      <dt className="col-sm-3 text-secondary">Placed</dt>
                      <dd className="col-sm-9">
                        {orderDetail.createdAt ? new Date(orderDetail.createdAt).toLocaleString() : '—'}
                      </dd>
                    </dl>
                    <h3 className="h6 fw-bold border-bottom border-secondary pb-2 mb-2">Line items</h3>
                    <ul className="list-unstyled mb-0">
                      {(orderDetail.items || []).map((line, idx) => (
                        <li
                          key={`${orderDetail.id}-${line.productId}-${idx}`}
                          className="d-flex justify-content-between py-2 border-bottom border-secondary border-opacity-25"
                        >
                          <span>
                            {line.name}{' '}
                            <span className="text-secondary">
                              × {line.quantity} @ {formatMoney(line.unitPrice)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-outline-light rounded-pill"
                  onClick={() => setOrderDetailId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
