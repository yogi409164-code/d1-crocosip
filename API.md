# Fruitzila API Documentation

**Base URL (Production):** `https://d1-crocosip.yogeshkumarpalikala.workers.dev`  
**Base URL (Local FastAPI):** `http://localhost:8000`  
**Interactive docs:** `{BASE_URL}/docs`  
**OpenAPI JSON:** `{BASE_URL}/openapi.json`

---

## How to use

### 1. Headers

| Header | When |
|--------|------|
| `Content-Type: application/json` | All POST/PUT requests |
| `Authorization: Bearer <access_token>` | Protected routes (after login) |

### 2. Login flow (mobile app)

```
1. POST /api/auth/send-otp     → SMS sent to phone
2. POST /api/auth/verify-otp   → get access_token
3. Use token on all protected APIs
```

### 3. Typical order flow

```
GET  /api/products
GET  /api/plans
POST /api/orders/create        (with token)
POST /api/payment/create       (with token)
POST /api/payment/verify       (with token)
GET  /api/orders/user/{id}     (with token)
```

### 4. Phone number format

Send **10-digit Indian mobile** (e.g. `9160916442`). Server sends SMS as `919160916442`.

### 5. Delivery rule

Orders placed **today** → delivered **next day** morning **6:00–9:00 AM** (unless `delivery_date` is set).

---

## Authentication

| Symbol | Meaning |
|--------|---------|
| No | Public |
| Yes | `Authorization: Bearer <token>` required |
| Admin | Token + `role: admin` |
| Delivery | Token + `role: delivery` or `admin` |

---

## API list (quick reference)

| # | Method | Endpoint | Auth |
|---|--------|----------|------|
| 1 | GET | `/health` | No |
| 2 | GET | `/health/db` | No |
| 3 | GET | `/health/db/view` | No |
| 4 | GET | `/api/db/test` | No |
| 5 | GET | `/docs` | No |
| 6 | POST | `/api/auth/send-otp` | No |
| 7 | POST | `/api/auth/verify-otp` | No |
| 8 | GET | `/api/auth/sms-status` | No |
| 9 | GET | `/api/auth/me` | Yes |
| 10 | PUT | `/api/auth/me` | Yes |
| 11 | GET | `/api/products` | No |
| 12 | GET | `/api/products/{id}` | No |
| 13 | POST | `/api/products` | Admin |
| 14 | PUT | `/api/products/{id}` | Admin |
| 15 | DELETE | `/api/products/{id}` | Admin |
| 16 | GET | `/api/plans` | No |
| 17 | GET | `/api/plans/{id}` | No |
| 18 | POST | `/api/plans` | Admin |
| 19 | PUT | `/api/plans/{id}` | Admin |
| 20 | DELETE | `/api/plans/{id}` | Admin |
| 21 | POST | `/api/orders/create` | Yes |
| 22 | GET | `/api/orders/user/{user_id}` | Yes |
| 23 | GET | `/api/orders/{order_id}` | Yes |
| 24 | POST | `/api/orders/{order_id}/skip` | Yes |
| 25 | POST | `/api/payment/create` | Yes |
| 26 | POST | `/api/payment/verify` | Yes |
| 27 | GET | `/api/payment/order/{order_id}` | Yes |
| 28 | GET | `/api/calendar/orders` | Yes |
| 29 | POST | `/api/subscription/subscribe` | Yes |
| 30 | GET | `/api/subscription/active` | Yes |
| 31 | POST | `/api/subscription/pause` | Yes |
| 32 | POST | `/api/subscription/resume` | Yes |
| 33 | POST | `/api/subscription/skip-date` | Yes |
| 34 | POST | `/api/coupons/validate` | Yes |
| 35 | GET | `/api/coupons` | No |
| 36 | POST | `/api/coupons` | Admin |
| 37 | GET | `/api/delivery/track/{order_id}` | Yes |
| 38 | PUT | `/api/delivery/track/{order_id}` | Delivery/Admin |
| 39 | GET | `/api/delivery/today` | Delivery/Admin |
| 40 | GET | `/api/admin/analytics` | Admin |
| 41 | GET | `/api/admin/orders/daily` | Admin |
| 42 | GET | `/api/admin/reports/payments` | Admin |
| 43 | GET | `/api/admin/reports/orders` | Admin |

---

## Detailed endpoints

---

### Health

#### `GET /health`

**Response 200**
```json
{ "status": "healthy", "api": "ok" }
```

#### `GET /health/db`

**Response 200**
```json
{
  "success": true,
  "database": "connected",
  "status": "ok",
  "message": "D1 database connected successfully",
  "latency_ms": 12,
  "database_name": "croco",
  "tables": ["users", "products", "orders"],
  "row_counts": { "users": 2, "products": 4 },
  "data": { "users": [], "products": [] }
}
```

---

### Auth

#### `POST /api/auth/send-otp`

Send OTP via MSG91 SMS.

**Request body**
```json
{
  "phone": "9160916442"
}
```

**Response 200 (SMS sent)**
```json
{
  "success": true,
  "sms_sent": true,
  "message": "OTP sent via SMS"
}
```

**Response 502 (MSG91 failed)**
```json
{
  "success": false,
  "sms_sent": false,
  "message": "MSG91 failed to send SMS",
  "detail": "error from MSG91",
  "attempts": ["flow-v5-1: ..."],
  "mobile": "919160916442"
}
```

**Response 503 (SMS not configured)**
```json
{
  "detail": "SMS not configured on server...",
  "success": false
}
```

---

#### `POST /api/auth/verify-otp`

**Request body**
```json
{
  "phone": "9160916442",
  "otp": "123456",
  "name": "Yogesh",
  "email": "user@email.com"
}
```

**Response 200**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user_id": 1,
  "role": "customer"
}
```

**Response 400**
```json
{ "detail": "Invalid or expired OTP", "success": false }
```

---

#### `GET /api/auth/sms-status`

Check if MSG91 is configured (no auth).

**Response 200**
```json
{
  "sms_configured": true,
  "auth_key_set": true,
  "template_id": "69c3d59519282f470f0ff0a3",
  "sender_id": "msg91",
  "country_code": "91",
  "dev_mode": false
}
```

---

#### `GET /api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response 200**
```json
{
  "id": 1,
  "name": "Yogesh",
  "phone": "9160916442",
  "email": "user@email.com",
  "role": "customer"
}
```

---

#### `PUT /api/auth/me`

**Request body**
```json
{
  "name": "Yogesh Kumar",
  "email": "new@email.com"
}
```

**Response 200**
```json
{ "message": "Profile updated", "success": true }
```

---

### Products

#### `GET /api/products`

**Response 200**
```json
[
  {
    "id": 1,
    "name": "Green Detox",
    "description": "Spinach, apple, ginger",
    "price": 89,
    "image": null,
    "category": "detox",
    "is_active": 1
  }
]
```

#### `GET /api/products/{id}`

**Response 200** — single product object  
**Response 404** — `{ "detail": "Product not found", "success": false }`

#### `POST /api/products` (Admin)

**Request body**
```json
{
  "name": "Mango Cooler",
  "description": "Fresh mango",
  "price": 99,
  "image": "https://cdn.example.com/mango.jpg",
  "category": "tropical"
}
```

**Response 201** — created product object

#### `PUT /api/products/{id}` (Admin)

**Request body** (all fields optional)
```json
{
  "name": "Updated Name",
  "price": 109,
  "is_active": 1
}
```

#### `DELETE /api/products/{id}` (Admin)

**Response 200**
```json
{ "message": "Product deactivated", "success": true }
```

---

### Subscription plans

#### `GET /api/plans`

**Response 200**
```json
[
  {
    "id": 1,
    "plan_name": "Weekly Fresh",
    "days": 7,
    "price": 699,
    "delivery_time": "06:00-09:00"
  }
]
```

#### `GET /api/plans/{id}`

**Response 200** — single plan  
**Response 404** — plan not found

#### `POST /api/plans` (Admin)

**Request body**
```json
{
  "plan_name": "Monthly Vitality",
  "days": 30,
  "price": 2499,
  "delivery_time": "06:00-09:00"
}
```

#### `PUT /api/plans/{id}` (Admin)

**Request body**
```json
{
  "plan_name": "Monthly Plus",
  "price": 2799
}
```

#### `DELETE /api/plans/{id}` (Admin)

**Response 200**
```json
{ "message": "Plan deleted", "success": true }
```

---

### Orders

#### `POST /api/orders/create`

Book order for **next-day delivery** (default).

**Request body**
```json
{
  "plan_id": 1,
  "items": [
    { "product_id": 1, "qty": 2 },
    { "product_id": 4, "qty": 1 }
  ],
  "delivery_date": "2026-05-20",
  "coupon_code": "FRUIT10"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| plan_id | Yes | Subscription plan id |
| items | Yes | Juice line items |
| delivery_date | No | `YYYY-MM-DD` (default: tomorrow) |
| coupon_code | No | e.g. `FRUIT10` |

**Response 201**
```json
{
  "id": 2,
  "user_id": 1,
  "plan_id": 1,
  "delivery_date": "2026-05-20",
  "status": "pending",
  "total_amount": 257,
  "items": [
    {
      "id": 1,
      "order_id": 2,
      "product_id": 1,
      "qty": 2,
      "product_name": "Green Detox",
      "product_price": 89
    }
  ]
}
```

---

#### `GET /api/orders/user/{user_id}`

**Response 200** — array of orders with `items`

---

#### `GET /api/orders/{order_id}`

**Response 200** — order with items  
**Response 403** — access denied  
**Response 404** — not found

---

#### `POST /api/orders/{order_id}/skip`

Skip delivery for that order date.

**Response 200**
```json
{ "message": "Order skipped for selected date", "success": true }
```

---

### Payments

#### `POST /api/payment/create`

**Request body**
```json
{
  "order_id": 2,
  "payment_method": "razorpay"
}
```

**Response 200**
```json
{
  "payment_id": 1,
  "order_id": 2,
  "amount": 257,
  "gateway": "razorpay",
  "gateway_order_id": "mock_order_2_1715960000",
  "key_id": "mock_key",
  "mock": true
}
```

---

#### `POST /api/payment/verify`

**Request body**
```json
{
  "order_id": 2,
  "transaction_id": "pay_abc123",
  "razorpay_payment_id": "pay_abc123"
}
```

**Response 200**
```json
{ "message": "Payment verified successfully", "success": true }
```

---

#### `GET /api/payment/order/{order_id}`

**Response 200**
```json
{
  "id": 1,
  "order_id": 2,
  "payment_method": "razorpay",
  "transaction_id": "pay_abc123",
  "status": "success"
}
```

---

### Calendar

#### `GET /api/calendar/orders`

**Query params:** `?start_date=2026-05-01&end_date=2026-05-31`

**Response 200** — array of orders with items (for calendar UI)

---

### Subscription

#### `POST /api/subscription/subscribe`

**Request body**
```json
{
  "plan_id": 1,
  "start_date": "2026-05-17"
}
```

**Response 201**
```json
{
  "id": 1,
  "user_id": 1,
  "plan_id": 1,
  "start_date": "2026-05-17",
  "end_date": "2026-05-24",
  "is_paused": 0,
  "is_active": 1,
  "plan_name": "Weekly Fresh",
  "days": 7,
  "price": 699,
  "delivery_time": "06:00-09:00"
}
```

---

#### `GET /api/subscription/active`

**Response 200** — active subscription or `null`

---

#### `POST /api/subscription/pause`

**Request body**
```json
{
  "paused_until": "2026-05-25"
}
```

**Response 200**
```json
{ "message": "Subscription paused", "success": true }
```

---

#### `POST /api/subscription/resume`

**Request body** — empty `{}`

**Response 200**
```json
{ "message": "Subscription resumed", "success": true }
```

---

#### `POST /api/subscription/skip-date`

Skip one delivery day on calendar.

**Request body**
```json
{
  "skip_date": "2026-05-22"
}
```

**Response 200**
```json
{ "message": "Delivery skipped for selected date", "success": true }
```

---

### Coupons

#### `POST /api/coupons/validate`

**Request body**
```json
{
  "code": "FRUIT10",
  "order_amount": 500
}
```

**Response 200**
```json
{
  "valid": true,
  "discount_amount": 50,
  "message": "Coupon applied"
}
```

---

#### `GET /api/coupons`

**Response 200** — list of active coupons

---

#### `POST /api/coupons` (Admin)

**Request body**
```json
{
  "code": "SUMMER20",
  "description": "20% off",
  "discount_percent": 20,
  "min_order_amount": 300,
  "max_uses": 100
}
```

---

### Delivery tracking

#### `GET /api/delivery/track/{order_id}`

**Response 200**
```json
{
  "id": 1,
  "order_id": 2,
  "delivery_partner_id": null,
  "status": "scheduled",
  "latitude": null,
  "longitude": null,
  "updated_at": "2026-05-17 12:00:00"
}
```

---

#### `PUT /api/delivery/track/{order_id}` (Delivery / Admin)

**Request body**
```json
{
  "status": "out_for_delivery",
  "latitude": "28.6139",
  "longitude": "77.2090"
}
```

Status values: `scheduled`, `out_for_delivery`, `delivered`, `skipped`

---

#### `GET /api/delivery/today`

**Query:** `?delivery_date=2026-05-18`

**Response 200** — today's delivery orders with items

---

### Admin

#### `GET /api/admin/analytics`

**Response 200**
```json
{
  "total_customers": 10,
  "total_orders": 25,
  "total_revenue": 15000,
  "deliveries_today": 5
}
```

---

#### `GET /api/admin/orders/daily`

**Query:** `?delivery_date=2026-05-18`

**Response 200**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "delivery_date": "2026-05-18",
    "status": "confirmed",
    "total_amount": 699
  }
]
```

---

#### `GET /api/admin/reports/payments`

**Query:** `?days=30`

**Response 200** — payment list

---

#### `GET /api/admin/reports/orders`

**Query:** `?days=30`

**Response 200** — order list

---

## Error format

Most errors return:

```json
{
  "detail": "Error message here",
  "success": false
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / invalid OTP |
| 401 | Missing or invalid token |
| 403 | Not allowed (wrong role) |
| 404 | Resource not found |
| 422 | Validation error |
| 502 | MSG91 / external service failed |
| 503 | SMS not configured |

---

## React Native example

```javascript
const BASE = "https://d1-crocosip.yogeshkumarpalikala.workers.dev";

// 1. Send OTP
await fetch(`${BASE}/api/auth/send-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "9160916442" }),
});

// 2. Verify OTP
const login = await fetch(`${BASE}/api/auth/verify-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "9160916442", otp: "123456", name: "Yogesh" }),
});
const { access_token, user_id } = await login.json();

// 3. Authenticated request
const products = await fetch(`${BASE}/api/products`, {
  headers: { Authorization: `Bearer ${access_token}` },
});
```

---

## Postman collection tip

1. Create environment variable `base_url` = your Worker URL  
2. Create variable `token` = empty  
3. In **verify-otp** Tests tab: `pm.environment.set("token", pm.response.json().access_token)`  
4. Collection auth: Bearer `{{token}}`

---

**Fruitzila** — Book today, delivered next morning (6–9 AM).
