import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { DATABASE_PATH, db, lastId, migrate, seedIfEmpty, rowToUser, withTransaction } from './db.js'
import { createAdminRouter } from './adminRoutes.js'

migrate()
seedIfEmpty()

const app = express()
const PORT = Number(process.env.PORT) || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/categories', (_req, res) => {
  const rows = db.prepare('SELECT id, name FROM categories ORDER BY name').all()
  res.json(rows)
})

app.get('/api/products', (req, res) => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null
  let sql = `
    SELECT p.id, p.name, p.description, p.price, p.image_url AS image,
           c.id AS category_id, c.name AS category
    FROM products p
    JOIN categories c ON c.id = p.category_id
  `
  const params = []
  if (categoryId) {
    sql += ' WHERE p.category_id = ?'
    params.push(categoryId)
  }
  sql += ' ORDER BY p.name'
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

app.get('/api/products/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!id) {
    return res.status(400).json({ error: 'Invalid product id' })
  }
  const row = db
    .prepare(
      `SELECT p.id, p.name, p.description, p.price, p.image_url AS image,
              c.id AS category_id, c.name AS category
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
    )
    .get(id)
  if (!row) {
    return res.status(404).json({ error: 'Product not found' })
  }
  res.json(row)
})

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' })
  }
  const normalized = String(email).trim().toLowerCase()
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  try {
    const hash = bcrypt.hashSync(password, 10)
    const result = db
      .prepare(
        `INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?, 'user')`,
      )
      .run(normalized, hash, String(name).trim())
    const user = rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(lastId(result)))
    res.status(201).json({ token: signToken(user), user })
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' })
    }
    throw e
  }
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }
  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase())
  if (!row || !row.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (!bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const user = rowToUser(row)
  res.json({ token: signToken(user), user })
})

app.post('/api/auth/google', async (req, res) => {
  const { accessToken } = req.body || {}
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' })
  }
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) {
    return res.status(401).json({ error: 'Invalid Google token' })
  }
  const profile = await profileRes.json()
  if (!profile.sub || !profile.email) {
    return res.status(400).json({ error: 'Google profile incomplete' })
  }
  const email = String(profile.email).toLowerCase()
  let row = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(profile.sub)
  if (!row) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  }
  if (row) {
    db.prepare(
      `UPDATE users SET google_sub = COALESCE(?, google_sub), picture = ?, name = COALESCE(?, name) WHERE id = ?`,
    ).run(profile.sub, profile.picture || null, profile.name || null, row.id)
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id)
  } else {
    const result = db
      .prepare(
        `INSERT INTO users (email, password_hash, name, role, google_sub, picture)
         VALUES (?, NULL, ?, 'user', ?, ?)`,
      )
      .run(email, profile.name || 'Google User', profile.sub, profile.picture || null)
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(lastId(result))
  }
  const user = rowToUser(row)
  res.json({ token: signToken(user), user })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (!row) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.json(rowToUser(row))
})

app.patch('/api/users/me', authMiddleware, (req, res) => {
  const { name } = req.body || {}
  if (name === undefined || String(name).trim() === '') {
    return res.status(400).json({ error: 'name is required' })
  }
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim(), req.userId)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  res.json(rowToUser(row))
})

app.post('/api/orders', authMiddleware, (req, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' })
  }

  try {
    const orderId = withTransaction(() => {
      let subtotal = 0
      const resolved = []
      for (const line of items) {
        const productId = Number(line.productId)
        const quantity = Number(line.quantity)
        if (!productId || !quantity || quantity < 1) {
          throw new Error('BAD_ITEM')
        }
        const product = db.prepare('SELECT id, price, name FROM products WHERE id = ?').get(productId)
        if (!product) {
          throw new Error('UNKNOWN_PRODUCT')
        }
        const lineTotal = product.price * quantity
        subtotal += lineTotal
        resolved.push({ product, quantity, unitPrice: product.price })
      }
      const shipping = subtotal > 0 ? 8 : 0
      const total = subtotal + shipping

      const orderResult = db
        .prepare(
          `INSERT INTO orders (user_id, status, subtotal, shipping, total) VALUES (?, 'placed', ?, ?, ?)`,
        )
        .run(req.userId, subtotal, shipping, total)
      const newOrderId = lastId(orderResult)

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?,?,?,?)`,
      )
      for (const r of resolved) {
        insertItem.run(newOrderId, r.product.id, r.quantity, r.unitPrice)
      }
      return newOrderId
    })
    const order = db
      .prepare(
        `SELECT id, status, subtotal, shipping, total, created_at AS createdAt FROM orders WHERE id = ?`,
      )
      .get(orderId)
    res.status(201).json(order)
  } catch (e) {
    if (e.message === 'BAD_ITEM') {
      return res.status(400).json({ error: 'Each item needs valid productId and quantity' })
    }
    if (e.message === 'UNKNOWN_PRODUCT') {
      return res.status(400).json({ error: 'Unknown product in cart' })
    }
    throw e
  }
})

app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = db
    .prepare(
      `SELECT id, status, subtotal, shipping, total, created_at AS createdAt
       FROM orders WHERE user_id = ? ORDER BY datetime(created_at) DESC`,
    )
    .all(req.userId)

  const itemStmt = db.prepare(
    `SELECT oi.product_id AS productId, p.name, oi.quantity, oi.unit_price AS unitPrice
 FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
  )

  const payload = orders.map((o) => ({
    ...o,
    items: itemStmt.all(o.id),
  }))
  res.json(payload)
})

app.use(
  '/api/admin',
  createAdminRouter({
    db,
    jwtSecret: JWT_SECRET,
    lastId,
  }),
)

// eslint-disable-next-line no-unused-vars -- Express requires 4-arg error middleware signature
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

const server = app.listen(PORT, () => {
  const base = `http://localhost:${PORT}`
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Modern Shop API · SQLite (node:sqlite)')
  console.log(`  Listening:   ${base}`)
  console.log(`  Health check:  ${base}/api/health`)
  console.log(`  Database file: ${DATABASE_PATH}`)
  console.log('')
  console.log('  Public routes:')
  console.log('    GET     /api/categories')
  console.log('    GET     /api/products  ?categoryId=')
  console.log('    GET     /api/products/:id')
  console.log('    POST    /api/auth/register  /api/auth/login  /api/auth/google')
  console.log('    GET     /api/auth/me        PATCH /api/users/me')
  console.log('    POST    /api/orders         GET  /api/orders')
  console.log('')
  console.log('  Admin routes (Authorization: Bearer <JWT>, user role must be admin):')
  console.log('    GET     /api/admin/stats')
  console.log('    POST    /api/admin/categories     PATCH /api/admin/categories/:id   DELETE …')
  console.log('    POST    /api/admin/products       PATCH /api/admin/products/:id     DELETE …')
  console.log('    GET     /api/admin/users          PATCH /api/admin/users/:id          DELETE …')
  console.log('    GET     /api/admin/orders         PATCH /api/admin/orders/:id  { status }')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[Modern Shop API] Port ${PORT} is already in use (another terminal or app is using it).\n` +
        `Fix: close that process, or set PORT=3002 in .env and update vite.config.js proxy target to the same port.`,
    )
    process.exit(1)
  }
  throw err
})
