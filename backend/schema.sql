-- Fruitzila MySQL Schema
CREATE DATABASE IF NOT EXISTS fruitzila CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fruitzila;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    phone VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100),
    role ENUM('customer', 'admin', 'delivery') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image VARCHAR(255),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(100) NOT NULL,
    days INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    delivery_time VARCHAR(50) DEFAULT '06:00-09:00'
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    plan_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_paused BOOLEAN DEFAULT 0,
    paused_until DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE IF NOT EXISTS subscription_skip_dates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    subscription_id INT NOT NULL,
    skip_date DATE NOT NULL,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sub_skip (subscription_id, skip_date)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    plan_id INT,
    delivery_date DATE NOT NULL,
    status ENUM('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled', 'skipped') DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    coupon_code VARCHAR(50),
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL UNIQUE,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255),
    gateway_order_id VARCHAR(255),
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS coupons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    discount_percent DECIMAL(5, 2),
    discount_amount DECIMAL(10, 2),
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_uses INT,
    used_count INT DEFAULT 0,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL UNIQUE,
    delivery_partner_id INT,
    status VARCHAR(50) DEFAULT 'scheduled',
    latitude VARCHAR(50),
    longitude VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (delivery_partner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(15) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    verified BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_phone (phone)
);

-- Seed data
INSERT INTO subscription_plans (plan_name, days, price, delivery_time) VALUES
    ('Weekly Fresh', 7, 699.00, '06:00-09:00'),
    ('Monthly Vitality', 30, 2499.00, '06:00-09:00'),
    ('Weekend Boost', 14, 1299.00, '06:00-09:00');

INSERT INTO products (name, description, price, category, is_active) VALUES
    ('Green Detox', 'Spinach, apple, ginger', 89.00, 'detox', 1),
    ('Tropical Sunrise', 'Mango, pineapple, orange', 99.00, 'tropical', 1),
    ('Berry Blast', 'Strawberry, blueberry, beet', 109.00, 'berry', 1),
    ('Classic Orange', 'Fresh squeezed orange', 79.00, 'classic', 1);

INSERT INTO coupons (code, description, discount_percent, discount_amount, min_order_amount, max_uses, is_active) VALUES
    ('FRUIT10', '10% off your order', 10.00, NULL, 200.00, 100, 1),
    ('WELCOME50', 'Flat Rs 50 off', NULL, 50.00, 150.00, 500, 1);
