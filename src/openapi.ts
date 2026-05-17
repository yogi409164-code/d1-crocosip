export function getOpenApiSpec(origin: string) {
	return {
		openapi: "3.0.3",
		info: {
			title: "Fruitzila API (Cloudflare Worker + D1)",
			description:
				"Juice subscription API on Cloudflare Workers with D1 database. Book today → delivered next morning (6–9 AM).",
			version: "1.0.0",
		},
		servers: [{ url: origin }],
		tags: [
			{ name: "Health", description: "API & database health checks" },
			{ name: "Auth", description: "OTP login & JWT" },
			{ name: "Products", description: "Juice products" },
			{ name: "Plans", description: "Subscription plans" },
		],
		paths: {
			"/health": {
				get: {
					tags: ["Health"],
					summary: "API health",
					responses: { "200": { description: "OK" } },
				},
			},
			"/health/db": {
				get: {
					tags: ["Health"],
					summary: "Database health + all table data (JSON)",
					responses: { "200": { description: "Connected" }, "503": { description: "Disconnected" } },
				},
			},
			"/health/db/view": {
				get: {
					tags: ["Health"],
					summary: "Database health page (HTML)",
					responses: { "200": { description: "HTML page" } },
				},
			},
			"/api/db/test": {
				get: {
					tags: ["Health"],
					summary: "Database test (503 if down)",
					responses: { "200": { description: "Connected" }, "503": { description: "Disconnected" } },
				},
			},
			"/api/auth/send-otp": {
				post: {
					tags: ["Auth"],
					summary: "Send OTP to phone",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["phone"],
									properties: {
										phone: { type: "string", example: "9876543210" },
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "OTP sent (otp field returned for testing)",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											message: { type: "string" },
											success: { type: "boolean" },
											otp: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
			"/api/auth/verify-otp": {
				post: {
					tags: ["Auth"],
					summary: "Verify OTP and get JWT",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["phone", "otp"],
									properties: {
										phone: { type: "string", example: "9876543210" },
										otp: { type: "string", example: "123456" },
										name: { type: "string" },
										email: { type: "string" },
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "JWT token",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											access_token: { type: "string" },
											token_type: { type: "string" },
											user_id: { type: "integer" },
											role: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
			"/api/products": {
				get: {
					tags: ["Products"],
					summary: "List active products",
					responses: { "200": { description: "Product list" } },
				},
			},
			"/api/products/{product_id}": {
				get: {
					tags: ["Products"],
					summary: "Get product by ID",
					parameters: [
						{
							name: "product_id",
							in: "path",
							required: true,
							schema: { type: "integer" },
						},
					],
					responses: {
						"200": { description: "Product" },
						"404": { description: "Not found" },
					},
				},
			},
			"/api/plans": {
				get: {
					tags: ["Plans"],
					summary: "List subscription plans",
					responses: { "200": { description: "Plan list" } },
				},
			},
		},
	};
}
