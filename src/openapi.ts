const jsonBody = (schema: object, example?: object) => ({
	content: {
		"application/json": {
			schema,
			...(example ? { example } : {}),
		},
	},
});

const sec = [{ bearerAuth: [] as string[] }];

export function getOpenApiSpec(origin: string) {
	return {
		openapi: "3.0.3",
		info: {
			title: "Fruitzila API",
			description: `Juice subscription API. **Register first**, then login.

**Register:** name + phone + email + password → verify mobile OTP  
**Login:** mobile OTP | email/password | Google (registered users only)`,
			version: "1.0.0",
		},
		servers: [{ url: origin }],
		components: {
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
			},
			schemas: {
				RegisterRequest: {
					type: "object",
					required: ["name", "phone", "email", "password"],
					properties: {
						name: { type: "string", example: "Yogesh Kumar" },
						phone: { type: "string", example: "9160916442" },
						email: { type: "string", format: "email", example: "yogesh@email.com" },
						password: { type: "string", minLength: 6, example: "secret123" },
					},
				},
				VerifyPhoneRequest: {
					type: "object",
					required: ["phone", "otp"],
					properties: {
						phone: { type: "string", example: "9160916442" },
						otp: { type: "string", example: "123456" },
					},
				},
				GoogleRegisterRequest: {
					type: "object",
					required: ["id_token", "phone"],
					properties: {
						id_token: { type: "string", description: "Google Sign-In ID token" },
						phone: { type: "string", example: "9160916442" },
						password: { type: "string", minLength: 6, description: "Optional" },
					},
				},
				PhoneRequest: {
					type: "object",
					required: ["phone"],
					properties: { phone: { type: "string", example: "9160916442" } },
				},
				LoginEmailRequest: {
					type: "object",
					required: ["email", "password"],
					properties: {
						email: { type: "string", format: "email", example: "yogesh@email.com" },
						password: { type: "string", example: "secret123" },
					},
				},
				GoogleLoginRequest: {
					type: "object",
					required: ["id_token"],
					properties: { id_token: { type: "string" } },
				},
				TokenResponse: {
					type: "object",
					properties: {
						access_token: { type: "string" },
						token_type: { type: "string", example: "bearer" },
						user_id: { type: "integer" },
						role: { type: "string", example: "customer" },
					},
				},
				RegisterResponse: {
					type: "object",
					properties: {
						success: { type: "boolean" },
						user_id: { type: "integer" },
						sms_sent: { type: "boolean" },
						message: { type: "string" },
						next_step: { type: "string" },
						otp: { type: "string", description: "DEV_MODE only" },
					},
				},
				ErrorResponse: {
					type: "object",
					properties: {
						detail: { type: "string" },
						success: { type: "boolean", example: false },
					},
				},
			},
		},
		tags: [
			{ name: "Register", description: "Sign up — name, phone, email required + mobile OTP" },
			{ name: "Login", description: "Login — registered users only (mobile / email / Google)" },
			{ name: "Profile", description: "User profile (JWT required)" },
			{ name: "Health" },
			{ name: "Products" },
			{ name: "Plans" },
			{ name: "Orders" },
			{ name: "Payments" },
			{ name: "Calendar" },
			{ name: "Subscription" },
			{ name: "Coupons" },
			{ name: "Delivery" },
			{ name: "Admin" },
		],
		paths: {
			"/health": {
				get: { tags: ["Health"], summary: "API health", responses: { "200": { description: "OK" } } },
			},
			"/health/db": {
				get: { tags: ["Health"], summary: "DB health + data", responses: { "200": { description: "OK" } } },
			},
			"/api/auth/sms-status": {
				get: { tags: ["Profile"], summary: "Check MSG91 SMS config", responses: { "200": { description: "OK" } } },
			},

			// ─── REGISTER ─────────────────────────────────────────
			"/api/auth/register": {
				post: {
					tags: ["Register"],
					summary: "Sign up (name, phone, email, password)",
					description: "Creates account and sends OTP to mobile. Then call verify-phone.",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/RegisterRequest" }) },
					responses: {
						"201": {
							description: "Registered — verify phone next",
							content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterResponse" } } },
						},
						"409": { description: "Phone or email already exists" },
						"422": { description: "Validation error" },
					},
				},
			},
			"/api/auth/register/verify-phone": {
				post: {
					tags: ["Register"],
					summary: "Verify mobile OTP (complete signup)",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/VerifyPhoneRequest" }) },
					responses: {
						"200": {
							description: "JWT token",
							content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } },
						},
						"400": { description: "Invalid OTP" },
						"404": { description: "User not found" },
					},
				},
			},
			"/api/auth/register/google": {
				post: {
					tags: ["Register"],
					summary: "Sign up with Google + phone",
					description: "Google provides name/email. Phone required. Then verify-phone with OTP.",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/GoogleRegisterRequest" }) },
					responses: {
						"201": { description: "Registered — verify phone next" },
						"409": { description: "Already registered" },
					},
				},
			},

			// ─── LOGIN ────────────────────────────────────────────
			"/api/auth/login/mobile/send-otp": {
				post: {
					tags: ["Login"],
					summary: "Login — send mobile OTP",
					description: "User must be registered. Returns 404 if not.",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/PhoneRequest" }) },
					responses: {
						"200": { description: "OTP sent" },
						"404": { description: "Not registered — sign up first" },
						"503": { description: "SMS not configured" },
					},
				},
			},
			"/api/auth/login/mobile/verify": {
				post: {
					tags: ["Login"],
					summary: "Login — verify mobile OTP",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/VerifyPhoneRequest" }) },
					responses: {
						"200": {
							description: "JWT token",
							content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } },
						},
						"400": { description: "Invalid OTP" },
						"404": { description: "Not registered" },
					},
				},
			},
			"/api/auth/login/email": {
				post: {
					tags: ["Login"],
					summary: "Login — email + password",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/LoginEmailRequest" }) },
					responses: {
						"200": {
							description: "JWT token",
							content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } },
						},
						"401": { description: "Invalid credentials" },
						"404": { description: "Not registered" },
					},
				},
			},
			"/api/auth/login/google": {
				post: {
					tags: ["Login"],
					summary: "Login — Google Sign-In",
					description: "Pass Google id_token. User must already be registered.",
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/GoogleLoginRequest" }) },
					responses: {
						"200": {
							description: "JWT token",
							content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } },
						},
						"404": { description: "Not registered — sign up first" },
					},
				},
			},

			// Legacy (login)
			"/api/auth/send-otp": {
				post: {
					tags: ["Login"],
					summary: "[Legacy] Same as login/mobile/send-otp",
					deprecated: true,
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/PhoneRequest" }) },
					responses: { "200": { description: "OTP sent" } },
				},
			},
			"/api/auth/verify-otp": {
				post: {
					tags: ["Login"],
					summary: "[Legacy] Same as login/mobile/verify",
					deprecated: true,
					requestBody: { required: true, ...jsonBody({ $ref: "#/components/schemas/VerifyPhoneRequest" }) },
					responses: { "200": { description: "JWT token" } },
				},
			},

			// Profile
			"/api/auth/me": {
				get: {
					tags: ["Profile"],
					summary: "Get profile",
					security: sec,
					responses: { "200": { description: "User profile" } },
				},
				put: {
					tags: ["Profile"],
					summary: "Update profile",
					security: sec,
					responses: { "200": { description: "Updated" } },
				},
			},

			// Products
			"/api/products": {
				get: { tags: ["Products"], summary: "List products", responses: { "200": { description: "OK" } } },
				post: { tags: ["Products"], summary: "Create product (admin)", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/products/{id}": {
				get: {
					tags: ["Products"],
					summary: "Get product",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
				put: { tags: ["Products"], summary: "Update product (admin)", security: sec, responses: { "200": { description: "OK" } } },
				delete: { tags: ["Products"], summary: "Delete product (admin)", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/plans": {
				get: { tags: ["Plans"], summary: "List plans", responses: { "200": { description: "OK" } } },
				post: { tags: ["Plans"], summary: "Create plan (admin)", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/plans/{id}": {
				get: {
					tags: ["Plans"],
					summary: "Get plan",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
				put: { tags: ["Plans"], summary: "Update plan (admin)", security: sec, responses: { "200": { description: "OK" } } },
				delete: { tags: ["Plans"], summary: "Delete plan (admin)", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/orders/create": {
				post: { tags: ["Orders"], summary: "Create order", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/orders/user/{user_id}": {
				get: {
					tags: ["Orders"],
					summary: "Order history",
					security: sec,
					parameters: [{ name: "user_id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/orders/{order_id}": {
				get: {
					tags: ["Orders"],
					summary: "Get order",
					security: sec,
					parameters: [{ name: "order_id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/orders/{order_id}/skip": {
				post: {
					tags: ["Orders"],
					summary: "Skip order",
					security: sec,
					parameters: [{ name: "order_id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/payment/create": {
				post: { tags: ["Payments"], summary: "Create payment", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/payment/verify": {
				post: { tags: ["Payments"], summary: "Verify payment", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/payment/order/{order_id}": {
				get: {
					tags: ["Payments"],
					summary: "Get payment",
					security: sec,
					parameters: [{ name: "order_id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/calendar/orders": {
				get: {
					tags: ["Calendar"],
					summary: "Calendar orders",
					security: sec,
					parameters: [
						{ name: "start_date", in: "query", schema: { type: "string", format: "date" } },
						{ name: "end_date", in: "query", schema: { type: "string", format: "date" } },
					],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/subscription/subscribe": {
				post: { tags: ["Subscription"], summary: "Subscribe", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/subscription/active": {
				get: { tags: ["Subscription"], summary: "Active subscription", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/subscription/pause": {
				post: { tags: ["Subscription"], summary: "Pause subscription", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/subscription/resume": {
				post: { tags: ["Subscription"], summary: "Resume subscription", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/subscription/skip-date": {
				post: { tags: ["Subscription"], summary: "Skip delivery date", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/coupons/validate": {
				post: { tags: ["Coupons"], summary: "Validate coupon", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/coupons": {
				get: { tags: ["Coupons"], summary: "List coupons", responses: { "200": { description: "OK" } } },
				post: { tags: ["Coupons"], summary: "Create coupon (admin)", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/delivery/track/{order_id}": {
				get: {
					tags: ["Delivery"],
					summary: "Track delivery",
					security: sec,
					parameters: [{ name: "order_id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
				put: {
					tags: ["Delivery"],
					summary: "Update delivery",
					security: sec,
					parameters: [{ name: "order_id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/delivery/today": {
				get: { tags: ["Delivery"], summary: "Today's deliveries", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/admin/analytics": {
				get: { tags: ["Admin"], summary: "Analytics", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/admin/orders/daily": {
				get: { tags: ["Admin"], summary: "Daily orders", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/admin/reports/payments": {
				get: { tags: ["Admin"], summary: "Payment reports", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/admin/reports/orders": {
				get: { tags: ["Admin"], summary: "Order reports", security: sec, responses: { "200": { description: "OK" } } },
			},
		},
	};
}
