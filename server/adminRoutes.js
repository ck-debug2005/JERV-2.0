/**
 * Admin-only REST routes — full CRUD on categories, products, users; orders list/update.
 * All routes mounted under /api/admin — requires JWT with role === 'admin'.
 */
import express from 'express'
import jwt from 'jsonwebtoken'

export function createAdminRouter({ db, jwtSecret, lastId }) {
  const router = express.Router()

  router.use((req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const payload = jwt.verify(token, jwtSecret)
      if (payload.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden — admin only' })
      }
      req.adminUserId = payload.sub
      req.adminRole = payload.role
      next()
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  })

  function userPublic(row) {
    if (!row) return null
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      picture: row.picture || null,
      googleLinked: Boolean(row.google_sub),
      createdAt: row.createdAt ?? row.created_at,
    }
  }

  router.get('/stats', (_req, res) => {
    const users = Number(db.prepare('SELECT COUNT(*) AS n FROM users').get()?.n ?? 0)
    const products = Number(db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n ?? 0)
    const categories = Number(db.prepare('SELECT COUNT(*) AS n FROM categories').get()?.n ?? 0)
    const orders = Number(db.prepare('SELECT COUNT(*) AS n FROM orders').get()?.n ?? 0)
    const revenue = Number(db.prepare('SELECT COALESCE(SUM(total), 0) AS s FROM orders').get()?.s ?? 0)
    res.json({
      users,
      products,
      categories,
      orders,
      revenueTotal: revenue,
    })
  })

  /* Categories CRUD */
  router.post('/categories', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'name is required' })
    try {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name)
      const row = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(lastId(result))
      res.status(201).json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'Category name already exists' })
      }
      throw e
    }
  })

  router.patch('/categories/:id', (req, res) => {
    const id = Number(req.params.id)
    const name = String(req.body?.name ?? '').trim()
    if (!id || !name) return res.status(400).json({ error: 'valid id and name required' })
    try {
      const r = db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
      if (Number(r.changes) === 0) return res.status(404).json({ error: 'Category not found' })
      res.json(db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id))
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'Category name already exists' })
      }
      throw e
    }
  })

  router.delete('/categories/:id', (req, res) => {
    const id = Number(req.params.id)
    const count = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(id).n
    if (Number(count) > 0) {
      return res.status(409).json({ error: 'Cannot delete category that has products' })
    }
    const r = db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    if (Number(r.changes) === 0) return res.status(404).json({ error: 'Category not found' })
    res.status(204).send()
  })

  /* Products CRUD */
  router.post('/products', (req, res) => {
    const { categoryId, name, description, price, imageUrl } = req.body || {}
    const cid = Number(categoryId)
    const title = String(name ?? '').trim()
    const desc = String(description ?? '')
    const pr = Number(price)
    const img = String(imageUrl ?? '').trim()
    if (!cid || !title || !Number.isFinite(pr) || pr < 0 || !img) {
      return res.status(400).json({ error: 'categoryId, name, price, imageUrl required' })
    }
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(cid)
    if (!cat) return res.status(400).json({ error: 'Invalid categoryId' })
    const result = db
      .prepare(
        `INSERT INTO products (category_id, name, description, price, image_url) VALUES (?,?,?,?,?)`,
      )
      .run(cid, title, desc, pr, img)
    const pid = lastId(result)
    const row = db
      .prepare(
        `SELECT p.id, p.name, p.description, p.price, p.image_url AS image,
                c.id AS category_id, c.name AS category
         FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      )
      .get(pid)
    res.status(201).json(row)
  })

  router.patch('/products/:id', (req, res) => {
    const id = Number(req.params.id)
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })
    const { categoryId, name, description, price, imageUrl } = req.body || {}
    const cid = categoryId !== undefined ? Number(categoryId) : existing.category_id
    const title = name !== undefined ? String(name).trim() : existing.name
    const desc = description !== undefined ? String(description) : existing.description
    const pr = price !== undefined ? Number(price) : existing.price
    const img = imageUrl !== undefined ? String(imageUrl).trim() : existing.image_url
    if (!cid || !title || !Number.isFinite(pr) || pr < 0 || !img) {
      return res.status(400).json({ error: 'Invalid payload' })
    }
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(cid)
    if (!cat) return res.status(400).json({ error: 'Invalid categoryId' })
    db.prepare(
      `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, image_url = ? WHERE id = ?`,
    ).run(cid, title, desc, pr, img, id)
    const row = db
      .prepare(
        `SELECT p.id, p.name, p.description, p.price, p.image_url AS image,
                c.id AS category_id, c.name AS category
         FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      )
      .get(id)
    res.json(row)
  })

  router.delete('/products/:id', (req, res) => {
    const id = Number(req.params.id)
    const used = db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').get(id).n
    if (Number(used) > 0) {
      return res.status(409).json({ error: 'Cannot delete product that appears in orders' })
    }
    const r = db.prepare('DELETE FROM products WHERE id = ?').run(id)
    if (Number(r.changes) === 0) return res.status(404).json({ error: 'Product not found' })
    res.status(204).send()
  })

  /* Users CRUD (no password in responses) */
  router.get('/users', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, email, name, role, google_sub, picture, created_at AS createdAt FROM users ORDER BY id`,
      )
      .all()
    res.json(rows.map((r) => userPublic(r)))
  })

  router.get('/users/:id', (req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!row) return res.status(404).json({ error: 'User not found' })
    res.json(userPublic(row))
  })

  router.patch('/users/:id', (req, res) => {
    const id = Number(req.params.id)
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!target) return res.status(404).json({ error: 'User not found' })
    const { name, role } = req.body || {}
    if (name !== undefined && String(name).trim() === '') {
      return res.status(400).json({ error: 'name cannot be empty' })
    }
    if (role !== undefined && role !== 'user' && role !== 'admin') {
      return res.status(400).json({ error: 'role must be user or admin' })
    }
    if (role === 'user' && target.role === 'admin') {
      const admins = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n
      if (Number(admins) <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin' })
      }
    }
    const nextName = name !== undefined ? String(name).trim() : target.name
    const nextRole = role !== undefined ? role : target.role
    db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(nextName, nextRole, id)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    res.json(userPublic(row))
  })

  router.delete('/users/:id', (req, res) => {
    const id = Number(req.params.id)
    if (id === req.adminUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.role === 'admin') {
      const admins = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n
      if (Number(admins) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' })
      }
    }
    const orders = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?').get(id).n
    if (Number(orders) > 0) {
      return res.status(409).json({ error: 'Cannot delete user with existing orders' })
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    res.status(204).send()
  })

  /* Orders — list all + update status */
  router.get('/orders', (_req, res) => {
    const orders = db
      .prepare(
        `SELECT o.id, o.user_id AS userId, u.email AS userEmail, u.name AS userName,
                o.status, o.subtotal, o.shipping, o.total, o.created_at AS createdAt
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ORDER BY datetime(o.created_at) DESC`,
      )
      .all()
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

  router.get('/orders/:id', (req, res) => {
    const id = Number(req.params.id)
    const order = db
      .prepare(
        `SELECT o.id, o.user_id AS userId, u.email AS userEmail, u.name AS userName,
                o.status, o.subtotal, o.shipping, o.total, o.created_at AS createdAt
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.id = ?`,
      )
      .get(id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const items = db
      .prepare(
        `SELECT oi.product_id AS productId, p.name, oi.quantity, oi.unit_price AS unitPrice
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
      )
      .all(id)
    res.json({ ...order, items })
  })

  const ALLOWED_ORDER_STATUS = new Set(['placed', 'processing', 'shipped', 'cancelled'])

  router.patch('/orders/:id', (req, res) => {
    const id = Number(req.params.id)
    const status = String(req.body?.status ?? '').trim()
    if (!ALLOWED_ORDER_STATUS.has(status)) {
      return res.status(400).json({ error: 'Invalid status', allowed: [...ALLOWED_ORDER_STATUS] })
    }
    const r = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id)
    if (Number(r.changes) === 0) return res.status(404).json({ error: 'Order not found' })
    const order = db
      .prepare(
        `SELECT o.id, o.user_id AS userId, u.email AS userEmail,
                o.status, o.subtotal, o.shipping, o.total, o.created_at AS createdAt
         FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`,
      )
      .get(id)
    res.json(order)
  })

  return router
}
