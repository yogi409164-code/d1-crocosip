-- Migration number: 0004 	 2026-05-17T18:00:00.000Z

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_paused INTEGER DEFAULT 0,
  paused_until DATE,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE IF NOT EXISTS subscription_skip_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INT NOT NULL,
  skip_date DATE NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  UNIQUE(subscription_id, skip_date)
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  discount_percent DECIMAL(5, 2),
  discount_amount DECIMAL(10, 2),
  min_order_amount DECIMAL(10, 2) DEFAULT 0,
  max_uses INT,
  used_count INT DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INT NOT NULL UNIQUE,
  delivery_partner_id INT,
  status VARCHAR(50) DEFAULT 'scheduled',
  latitude VARCHAR(50),
  longitude VARCHAR(50),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (delivery_partner_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO coupons (code, description, discount_percent, min_order_amount, max_uses, is_active) VALUES
  ('FRUIT10', '10% off', 10.00, 200.00, 100, 1),
  ('WELCOME50', 'Flat Rs 50 off', NULL, 150.00, 500, 1);

UPDATE coupons SET discount_amount = 50.00 WHERE code = 'WELCOME50';
