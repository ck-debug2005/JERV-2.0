import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const DATABASE_PATH = path.join(dataDir, 'modern_shop.sqlite')
export const db = new DatabaseSync(DATABASE_PATH)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

export function withTransaction(fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function lastId(stmtResult) {
  const v = stmtResult?.lastInsertRowid
  return typeof v === 'bigint' ? Number(v) : Number(v)
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
      google_sub TEXT UNIQUE,
      picture TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      image_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'placed',
      subtotal REAL NOT NULL,
      shipping REAL NOT NULL,
      total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  `)
}

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM categories').get()
  if (Number(row?.count ?? 0) > 0) return

  const insertCat = db.prepare('INSERT INTO categories (name) VALUES (?)')
  const cats = ['Shoes', 'Bags', 'Accessories', 'Home', 'Clothing']
  const catIds = {}
  for (const name of cats) {
    const r = insertCat.run(name)
    catIds[name] = lastId(r)
  }

  const insertProduct = db.prepare(
    `INSERT INTO products (category_id, name, description, price, image_url) VALUES (?,?,?,?,?)`,
  )

  const catalog = [
    ['Shoes', 'AeroFit Runner', 'Lightweight daily trainer', 89, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'],
    ['Bags', 'Urban Leather Tote', 'Spacious carry-all', 74, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80'],
    ['Accessories', 'Lumen Smart Watch', 'Fitness tracking essentials', 129, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'],
    ['Home', 'Minimal Desk Lamp', 'Warm LED workspace light', 49, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
    ['Clothing', 'CloudWeave Hoodie', 'Soft everyday layer', 59, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80'],
    ['Home', 'Nordic Ceramic Set', 'Dinnerware for four', 44, 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?auto=format&fit=crop&w=900&q=80'],
  ]

  for (const [catName, name, desc, price, image] of catalog) {
    insertProduct.run(catIds[catName], name, desc, price, image)
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@modernshop.local'
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminChangeMe123!'
  const hash = bcrypt.hashSync(adminPassword, 10)
  db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?, 'admin')`).run(
    adminEmail,
    hash,
    'Store Admin',
  )

  db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?, 'user')`).run(
    'demo@modernshop.local',
    bcrypt.hashSync('DemoUser123!', 10),
    'Demo Customer',
  )
}

export function rowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    picture: row.picture || null,
    googleLinked: Boolean(row.google_sub),
  }
}
