-- Migration number: 0002 	 2026-05-17T00:00:00.000Z

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(100),
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'delivery')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image VARCHAR(255),
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_name VARCHAR(100) NOT NULL,
  days INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  delivery_time VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  delivery_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_orders_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INT NOT NULL UNIQUE,
  payment_method VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Seed data
INSERT INTO users (name, phone, email, role) VALUES
  ('Demo Customer', '9876543210', 'demo@fruitzila.com', 'customer'),
  ('Admin User', '9999999999', 'admin@fruitzila.com', 'admin');

INSERT INTO products (name, description, price, category, is_active) VALUES
  ('Green Detox', 'Spinach, apple, ginger', 89.00, 'detox', 1),
  ('Tropical Sunrise', 'Mango, pineapple, orange', 99.00, 'tropical', 1),
  ('Berry Blast', 'Strawberry, blueberry, beet', 109.00, 'berry', 1),
  ('Classic Orange', 'Fresh squeezed orange', 79.00, 'classic', 1);

INSERT INTO subscription_plans (plan_name, days, price, delivery_time) VALUES
  ('Weekly Fresh', 7, 699.00, '06:00-09:00'),
  ('Monthly Vitality', 30, 2499.00, '06:00-09:00'),
  ('Weekend Boost', 14, 1299.00, '06:00-09:00');

INSERT INTO orders (user_id, plan_id, delivery_date, status, total_amount) VALUES
  (1, 1, date('now', '+1 day'), 'confirmed', 699.00);

INSERT INTO order_items (order_id, product_id, qty) VALUES
  (1, 1, 1),
  (1, 4, 2);

INSERT INTO payments (order_id, payment_method, transaction_id, status) VALUES
  (1, 'razorpay', 'pay_demo_001', 'success');
