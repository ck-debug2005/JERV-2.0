import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.getOrders()
        if (!cancelled) setOrders(data)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load orders')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) {
    return (
      <div className="container py-5">
        <div className="alert alert-info shadow-sm">
          <Link to="/login" className="alert-link">
            Log in
          </Link>{' '}
          to view your order history.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
        <p className="text-secondary mt-3 small">Loading your orders…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container py-5">
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 text-center">
            <h1 className="h4 fw-bold">No orders yet</h1>
            <p className="text-secondary mb-0">
              <Link to="/">Browse products</Link> and place your first order.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-2 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Order history</h1>
          <p className="text-secondary small mb-0">Track purchases and totals in one place.</p>
        </div>
      </div>

      <div className="accordion shadow-sm" id="ordersAccordion">
        {orders.map((order, idx) => (
          <div key={order.id} className="accordion-item border-0 border-bottom">
            <h2 className="accordion-header" id={`heading-${order.id}`}>
              <button
                className={`accordion-button ${idx === 0 ? '' : 'collapsed'} fw-semibold`}
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#collapse-${order.id}`}
                aria-expanded={idx === 0 ? 'true' : 'false'}
                aria-controls={`collapse-${order.id}`}
              >
                <span className="me-auto">Order #{order.id}</span>
                <span className="small text-secondary fw-normal ms-2">
                  {order.status} · {order.createdAt}
                </span>
              </button>
            </h2>
            <div
              id={`collapse-${order.id}`}
              className={`accordion-collapse collapse ${idx === 0 ? 'show' : ''}`}
              aria-labelledby={`heading-${order.id}`}
              data-bs-parent="#ordersAccordion"
            >
              <div className="accordion-body">
                <ul className="list-group list-group-flush rounded-3 mb-3">
                  {order.items.map((line) => (
                    <li
                      key={`${order.id}-${line.productId}`}
                      className="list-group-item d-flex justify-content-between align-items-center px-0"
                    >
                      <span>
                        {line.name}{' '}
                        <span className="text-secondary small">× {line.quantity}</span>
                      </span>
                      <span className="fw-semibold">${Number(line.unitPrice).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="d-flex flex-wrap gap-3 justify-content-end small">
                  <span className="text-secondary">Subtotal ${Number(order.subtotal).toFixed(2)}</span>
                  <span className="text-secondary">Shipping ${Number(order.shipping).toFixed(2)}</span>
                  <span className="fw-bold text-primary">Total ${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
