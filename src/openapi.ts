export function getOpenApiSpec(origin: string) {
	const bearer = { bearerAuth: [] as string[] };
	const sec = [{ bearerAuth: [] as string[] }];

	return {
		openapi: "3.0.3",
		info: {
			title: "Fruitzila API",
			description:
				"Juice subscription platform — Cloudflare Worker + D1. Book today → delivered next morning (6–9 AM).",
			version: "1.0.0",
		},
		servers: [{ url: origin }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
		},
		tags: [
			{ name: "Health" },
			{ name: "Auth" },
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
			"/health": { get: { tags: ["Health"], summary: "API health", responses: { "200": { description: "OK" } } } },
			"/health/db": {
				get: { tags: ["Health"], summary: "DB health + data", responses: { "200": { description: "OK" } } },
			},
			"/api/auth/send-otp": {
				post: {
					tags: ["Auth"],
					summary: "Send OTP",
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { phone: { type: "string", example: "9876543210" } },
									required: ["phone"],
								},
							},
						},
					},
					responses: { "200": { description: "OTP sent" } },
				},
			},
			"/api/auth/verify-otp": {
				post: {
					tags: ["Auth"],
					summary: "Verify OTP → JWT",
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										phone: { type: "string" },
										otp: { type: "string" },
										name: { type: "string" },
										email: { type: "string" },
									},
									required: ["phone", "otp"],
								},
							},
						},
					},
					responses: { "200": { description: "JWT token" } },
				},
			},
			"/api/auth/me": {
				get: { tags: ["Auth"], summary: "Profile", security: sec, responses: { "200": { description: "OK" } } },
				put: { tags: ["Auth"], summary: "Update profile", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/products": {
				get: { tags: ["Products"], summary: "List products", responses: { "200": { description: "OK" } } },
				post: { tags: ["Products"], summary: "Create product (admin)", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/products/{id}": {
				get: { tags: ["Products"], summary: "Get product", parameters: [{ name: "id", in: "path", schema: { type: "integer" } }], responses: { "200": { description: "OK" } } },
				put: { tags: ["Products"], summary: "Update product (admin)", security: sec, responses: { "200": { description: "OK" } } },
				delete: { tags: ["Products"], summary: "Deactivate product (admin)", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/plans": {
				get: { tags: ["Plans"], summary: "List plans", responses: { "200": { description: "OK" } } },
				post: { tags: ["Plans"], summary: "Create plan (admin)", security: sec, responses: { "201": { description: "Created" } } },
			},
			"/api/plans/{id}": {
				get: { tags: ["Plans"], summary: "Get plan", parameters: [{ name: "id", in: "path", schema: { type: "integer" } }], responses: { "200": { description: "OK" } } },
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
					parameters: [{ name: "user_id", in: "path", schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/orders/{order_id}": {
				get: {
					tags: ["Orders"],
					summary: "Get order",
					security: sec,
					parameters: [{ name: "order_id", in: "path", schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/orders/{order_id}/skip": {
				post: {
					tags: ["Orders"],
					summary: "Skip order date",
					security: sec,
					parameters: [{ name: "order_id", in: "path", schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/payment/create": {
				post: { tags: ["Payments"], summary: "Initiate payment", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/payment/verify": {
				post: { tags: ["Payments"], summary: "Verify payment", security: sec, responses: { "200": { description: "OK" } } },
			},
			"/api/payment/order/{order_id}": {
				get: {
					tags: ["Payments"],
					summary: "Payment by order",
					security: sec,
					parameters: [{ name: "order_id", in: "path", schema: { type: "integer" } }],
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
				post: { tags: ["Subscription"], summary: "Subscribe to plan", security: sec, responses: { "201": { description: "Created" } } },
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
					parameters: [{ name: "order_id", in: "path", schema: { type: "integer" } }],
					responses: { "200": { description: "OK" } },
				},
				put: {
					tags: ["Delivery"],
					summary: "Update tracking (delivery/admin)",
					security: sec,
					parameters: [{ name: "order_id", in: "path", schema: { type: "integer" } }],
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
