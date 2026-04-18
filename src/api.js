const API_BASE = import.meta.env.VITE_API_URL || ''

function getStoredToken() {
  return localStorage.getItem('modern_shop_jwt')
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('modern_shop_jwt', token)
  } else {
    localStorage.removeItem('modern_shop_jwt')
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getStoredToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text || 'Request failed' }
  }
  if (!res.ok) {
    const message = data?.error || res.statusText || 'Request failed'
    throw new Error(message)
  }
  return data
}

export const api = {
  getCategories: () => request('/api/categories'),
  getProducts: (categoryId) => {
    const q = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
    return request(`/api/products${q}`)
  },
  getProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`),
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  googleLogin: (accessToken) =>
    request('/api/auth/google', { method: 'POST', body: JSON.stringify({ accessToken }) }),
  me: () => request('/api/auth/me'),
  updateProfile: (body) =>
    request('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  createOrder: (items) =>
    request('/api/orders', { method: 'POST', body: JSON.stringify({ items }) }),
  getOrders: () => request('/api/orders'),

  /** Admin — requires logged-in admin JWT */
  adminStats: () => request('/api/admin/stats'),
  adminCreateCategory: (body) =>
    request('/api/admin/categories', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateCategory: (id, body) =>
    request(`/api/admin/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteCategory: (id) =>
    request(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminCreateProduct: (body) =>
    request('/api/admin/products', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateProduct: (id, body) =>
    request(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteProduct: (id) =>
    request(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminGetUsers: () => request('/api/admin/users'),
  adminUpdateUser: (id, body) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteUser: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminGetOrders: () => request('/api/admin/orders'),
  adminGetOrder: (id) =>
    request(`/api/admin/orders/${encodeURIComponent(id)}`),
  adminUpdateOrderStatus: (id, body) =>
    request(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
}
