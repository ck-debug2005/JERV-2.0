-- Modern Shop — MySQL schema (PHP API)
-- Run: mysql -u root -p < sql/schema.sql

CREATE DATABASE IF NOT EXISTS modern_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE modern_shop;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  google_sub VARCHAR(255) NULL UNIQUE,
  picture VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(1024) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'placed',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB;

CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_orders_user ON orders (user_id);

INSERT IGNORE INTO categories (id, name) VALUES
  (1, 'Shoes'),
  (2, 'Bags'),
  (3, 'Accessories'),
  (4, 'Home'),
  (5, 'Clothing');

INSERT IGNORE INTO products (id, category_id, name, description, price, image_url) VALUES
  (1, 1, 'AeroFit Runner', 'Lightweight daily trainer', 89.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'),
  (2, 2, 'Urban Leather Tote', 'Spacious carry-all', 74.00, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80'),
  (3, 3, 'Lumen Smart Watch', 'Fitness tracking essentials', 129.00, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'),
  (4, 4, 'Minimal Desk Lamp', 'Warm LED workspace light', 49.00, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'),
  (5, 5, 'CloudWeave Hoodie', 'Soft everyday layer', 59.00, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80'),
  (6, 4, 'Nordic Ceramic Set', 'Dinnerware for four', 44.00, 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?auto=format&fit=crop&w=900&q=80');

-- Passwords: AdminChangeMe123! (admin) and DemoUser123! (demo) — bcrypt compatible with PHP & Node
INSERT IGNORE INTO users (id, email, password_hash, name, role) VALUES
  (1, 'admin@modernshop.local', '$2b$10$DSF4zNcY3zVhqkGApLoQT.wnBNbWnxuQ8FuZ8HywSqlPjGJJF3rYe', 'Store Admin', 'admin'),
  (2, 'demo@modernshop.local', '$2b$10$fVyomr.1STUylFeq29Mut.xSPE9.A4subimmG2KkG5oQiBEcv3YWe', 'Demo Customer', 'user');
