import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

function CartBody({
  cart,
  changeQuantity,
  removeFromCart,
  subtotal,
  shipping,
  total,
  orderMessage,
  user,
  orderBusy,
  placeOrder,
}) {
  return (
    <>
      {cart.length === 0 ? (
        <p className="text-secondary small mb-0">Your cart is empty. Add products to get started.</p>
      ) : (
        <div className="cart-lines">
          {cart.map((item) => (
            <div key={item.id} className="cart-line-item">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div className="fw-semibold">{item.name}</div>
                  <small className="text-secondary">${item.price} each</small>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                <div className="input-group input-group-sm" style={{ maxWidth: '9.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => changeQuantity(item.id, item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="input-group-text flex-grow-1 justify-content-center fw-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => changeQuantity(item.id, item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => removeFromCart(item.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr className="my-3" />

      <dl className="row small mb-0">
        <dt className="col-6">Subtotal</dt>
        <dd className="col-6 text-end">${subtotal.toFixed(2)}</dd>
        <dt className="col-6">Shipping</dt>
        <dd className="col-6 text-end">${shipping.toFixed(2)}</dd>
        <dt className="col-6 fw-bold pt-2">Total</dt>
        <dd className="col-6 text-end fw-bold pt-2">${total.toFixed(2)}</dd>
      </dl>

      {orderMessage && (
        <div className="alert alert-success border-0 py-2 small mt-3 mb-0" style={{ background: '#1a3d28', color: '#c8f7d0' }}>
          {orderMessage}
        </div>
      )}

      {!user && (
        <p className="text-secondary small mt-3 mb-0">
          <Link to="/login">Log in</Link> or <Link to="/register">register</Link> to place an order.
        </p>
      )}

      <button
        type="button"
        className="btn btn-spotify w-100 rounded-pill fw-bold mt-3 py-2"
        disabled={!cart.length || !user || orderBusy}
        onClick={placeOrder}
      >
        {!user ? 'Login to place order' : orderBusy ? 'Placing order…' : 'Place order'}
      </button>
    </>
  )
}

export function ShopPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { cart, addToCart, changeQuantity, removeFromCart, clearCart, cartCount } = useCart()

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [orderBusy, setOrderBusy] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cats, prods] = await Promise.all([api.getCategories(), api.getProducts()])
        if (cancelled) return
        setCategories(cats)
        setProducts(prods)
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Could not load catalog')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleProducts = useMemo(() => {
    if (!activeCategoryId) return products
    return products.filter((p) => p.category_id === activeCategoryId)
  }, [products, activeCategoryId])

  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const shipping = subtotal > 0 ? 8 : 0
  const total = subtotal + shipping

  const placeOrder = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    setOrderMessage('')
    setOrderBusy(true)
    try {
      const items = cart.map((line) => ({ productId: line.id, quantity: line.quantity }))
      await api.createOrder(items)
      clearCart()
      setOrderMessage('Order placed successfully.')
      navigate('/orders')
    } catch (e) {
      setOrderMessage(e.message || 'Order failed')
    } finally {
      setOrderBusy(false)
    }
  }

  const cartProps = {
    cart,
    changeQuantity,
    removeFromCart,
    subtotal,
    shipping,
    total,
    orderMessage,
    user,
    orderBusy,
    placeOrder,
  }

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      <section className="hero-spotify rounded-4 text-white p-4 p-md-5 mb-4">
        <p className="text-uppercase small opacity-75 mb-2" style={{ letterSpacing: '0.12em' }}>
          New season collection
        </p>
        <h1 className="display-5 fw-bold mb-3" style={{ letterSpacing: '-0.03em' }}>
          Play it loud. Wear it bold.
        </h1>
        <p className="lead mb-0 text-white-50 col-lg-9">
          Curated drops, deep blacks, and that signature green hit — your shop, remixed like a playlist.
        </p>
      </section>

      {loadError && (
        <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
          <span>{loadError}</span>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Categories">
        <button
          type="button"
          className={`btn btn-sm rounded-pill fw-semibold ${activeCategoryId === null ? 'btn-spotify' : 'btn-outline-light border-secondary text-white-50'}`}
          onClick={() => setActiveCategoryId(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn btn-sm rounded-pill fw-semibold ${activeCategoryId === c.id ? 'btn-spotify' : 'btn-outline-light border-secondary text-white-50'}`}
            onClick={() => setActiveCategoryId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-lg-8 order-2 order-lg-1">
          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-4">
            {visibleProducts.map((product) => (
              <div key={product.id} className="col">
                <div className="card h-100 product-card-hover overflow-hidden text-white">
                  <div className="ratio ratio-4x3">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="object-fit-cover w-100 h-100"
                    />
                  </div>
                  <div className="card-body d-flex flex-column">
                    <p className="text-secondary text-uppercase small mb-1 fw-bold" style={{ letterSpacing: '0.08em' }}>
                      {product.category}
                    </p>
                    <h2 className="h5 card-title fw-bold">{product.name}</h2>
                    <div className="mt-auto d-flex justify-content-between align-items-center pt-2">
                      <span className="fs-5 fw-bold text-spotify">${product.price}</span>
                      <button
                        type="button"
                        className="btn btn-spotify btn-sm rounded-pill px-3 fw-bold"
                        onClick={() => addToCart(product)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-lg-4 order-1 order-lg-2">
          <div className="card border-0 shadow sticky-lg-top d-none d-lg-block cart-panel-spotify" id="cart-panel" style={{ top: '5.5rem' }}>
            <div className="card-header d-flex justify-content-between align-items-center py-3">
              <span className="fw-bold">Your cart</span>
              <span className="badge rounded-pill text-bg-dark border border-secondary" style={{ color: 'var(--spotify-green)' }}>
                {cartCount}
              </span>
            </div>
            <div className="card-body">
              <CartBody {...cartProps} />
            </div>
          </div>

          <div
            className="offcanvas offcanvas-end d-lg-none text-bg-dark bg-black border-start border-secondary"
            tabIndex="-1"
            id="cartOffcanvas"
            aria-labelledby="cartOffcanvasLabel"
          >
            <div className="offcanvas-header border-secondary border-bottom">
              <h2 className="offcanvas-title h5 mb-0 fw-bold" id="cartOffcanvasLabel">
                Your cart
              </h2>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close" />
            </div>
            <div className="offcanvas-body">
              <CartBody {...cartProps} />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-spotify rounded-pill shadow-lg cart-fab d-lg-none position-fixed bottom-0 end-0 m-3 d-inline-flex align-items-center gap-2 px-4 py-2 fw-bold"
        data-bs-toggle="offcanvas"
        data-bs-target="#cartOffcanvas"
        aria-controls="cartOffcanvas"
      >
        Cart
        <span className="badge bg-black text-spotify rounded-pill border border-secondary">{cartCount}</span>
      </button>

      <footer className="page-footer mt-5 pt-4 pb-5 text-center small">
        Modern Shop — Spotify-inspired UI · Node or PHP API · Google OAuth
      </footer>
    </div>
  )
}
