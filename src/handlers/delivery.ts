import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";
import { loadOrderWithItems } from "../lib/orders";

export async function trackOrder(request: Request, env: Env, orderId: number): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const order = await env.DB.prepare<{ user_id: number }>("SELECT user_id FROM orders WHERE id = ?")
		.bind(orderId)
		.first();
	if (!order) return error("Order not found", 404);
	if (
		order.user_id !== user.id &&
		user.role !== "admin" &&
		user.role !== "delivery"
	) {
		return error("Access denied", 403);
	}

	const tracking = await env.DB.prepare("SELECT * FROM delivery_tracking WHERE order_id = ?")
		.bind(orderId)
		.first();
	if (!tracking) return error("Tracking not found", 404);
	return json(tracking);
}

export async function updateTracking(
	request: Request,
	env: Env,
	orderId: number,
): Promise<Response> {
	const user = await requireAuth(request, env, ["delivery", "admin"]);
	if (isResponse(user)) return user;

	const body = await parseJson<{
		status: string;
		latitude?: string;
		longitude?: string;
	}>(request);
	if (!body?.status) return error("status is required", 422);

	await env.DB.prepare(
		`UPDATE delivery_tracking SET status = ?, latitude = ?, longitude = ?,
     delivery_partner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
	)
		.bind(
			body.status,
			body.latitude ?? null,
			body.longitude ?? null,
			user.role === "delivery" ? user.id : null,
			orderId,
		)
		.run();

	if (body.status === "out_for_delivery") {
		await env.DB.prepare("UPDATE orders SET status = 'out_for_delivery' WHERE id = ?")
			.bind(orderId)
			.run();
	}
	if (body.status === "delivered") {
		await env.DB.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").bind(orderId).run();
	}

	const tracking = await env.DB.prepare("SELECT * FROM delivery_tracking WHERE order_id = ?")
		.bind(orderId)
		.first();
	return json(tracking);
}

export async function todayDeliveries(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["delivery", "admin"]);
	if (isResponse(user)) return user;

	const url = new URL(request.url);
	const deliveryDate = url.searchParams.get("delivery_date") ?? new Date().toISOString().slice(0, 10);

	const { results } = await env.DB.prepare(
		`SELECT id FROM orders WHERE delivery_date = ? AND status IN ('confirmed', 'out_for_delivery')`,
	)
		.bind(deliveryDate)
		.all();

	const orders = [];
	for (const row of results) {
		const full = await loadOrderWithItems(env.DB, row.id as number);
		if (full) orders.push(full);
	}
	return json(orders);
}
