import { isResponse, requireAuth } from "../lib/auth";
import { calculateDiscount } from "../lib/coupons";
import { error, json, parseJson } from "../lib/http";

export async function validateCoupon(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<{ code: string; order_amount: number }>(request);
	if (!body?.code) return error("code is required", 422);

	const result = await calculateDiscount(env, body.code, body.order_amount ?? 0);
	return json({
		valid: result.valid,
		discount_amount: result.discount,
		message: result.message,
	});
}

export async function listCoupons(env: Env): Promise<Response> {
	const { results } = await env.DB.prepare("SELECT * FROM coupons WHERE is_active = 1").all();
	return json(results);
}

export async function createCoupon(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;

	const body = await parseJson<Record<string, unknown>>(request);
	if (!body?.code) return error("code is required", 422);

	const result = await env.DB.prepare(
		`INSERT INTO coupons (code, description, discount_percent, discount_amount, min_order_amount, max_uses, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
	)
		.bind(
			body.code,
			body.description ?? null,
			body.discount_percent ?? null,
			body.discount_amount ?? null,
			body.min_order_amount ?? 0,
			body.max_uses ?? null,
		)
		.run();

	const coupon = await env.DB.prepare("SELECT * FROM coupons WHERE id = ?")
		.bind(result.meta.last_row_id)
		.first();
	return json(coupon, 201);
}
