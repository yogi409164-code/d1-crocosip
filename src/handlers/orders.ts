import { isResponse, requireAuth } from "../lib/auth";
import { calculateDiscount } from "../lib/coupons";
import { nextDeliveryDate } from "../lib/delivery";
import { error, json, parseJson } from "../lib/http";
import { loadOrderWithItems, loadUserOrders } from "../lib/orders";

type OrderItemInput = { product_id: number; qty: number };
type CreateOrderBody = {
	plan_id: number;
	items: OrderItemInput[];
	delivery_date?: string;
	coupon_code?: string;
};

export async function createOrder(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<CreateOrderBody>(request);
	if (!body?.plan_id || !body.items?.length) {
		return error("plan_id and items are required", 422);
	}

	const plan = await env.DB.prepare("SELECT id FROM subscription_plans WHERE id = ?")
		.bind(body.plan_id)
		.first();
	if (!plan) return error("Plan not found", 404);

	let subtotal = 0;
	for (const item of body.items) {
		const product = await env.DB.prepare<{ price: number; is_active: number }>(
			"SELECT price, is_active FROM products WHERE id = ?",
		)
			.bind(item.product_id)
			.first();
		if (!product || !product.is_active) {
			return error(`Product ${item.product_id} not found`, 404);
		}
		subtotal += Number(product.price) * item.qty;
	}

	let discount = 0;
	if (body.coupon_code) {
		const c = await calculateDiscount(env, body.coupon_code, subtotal);
		if (!c.valid) return error(c.message, 400);
		discount = c.discount;
		await env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?")
			.bind(body.coupon_code)
			.run();
	}

	const total = subtotal - discount;
	const deliveryDate = body.delivery_date ?? nextDeliveryDate();

	const orderResult = await env.DB.prepare(
		"INSERT INTO orders (user_id, plan_id, delivery_date, status, total_amount) VALUES (?, ?, ?, 'pending', ?)",
	)
		.bind(user.id, body.plan_id, deliveryDate, total)
		.run();

	const orderId = Number(orderResult.meta.last_row_id);

	for (const item of body.items) {
		await env.DB.prepare("INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?)")
			.bind(orderId, item.product_id, item.qty)
			.run();
	}

	await env.DB.prepare("INSERT INTO delivery_tracking (order_id, status) VALUES (?, 'scheduled')")
		.bind(orderId)
		.run();

	const order = await loadOrderWithItems(env.DB, orderId);
	return json(order, 201);
}

export async function userOrders(
	request: Request,
	env: Env,
	userId: number,
): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;
	if (user.id !== userId && user.role !== "admin") {
		return error("Access denied", 403);
	}
	const orders = await loadUserOrders(env.DB, userId);
	return json(orders);
}

export async function getOrder(request: Request, env: Env, orderId: number): Promise<Response> {
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
	const full = await loadOrderWithItems(env.DB, orderId);
	return json(full);
}

export async function skipOrder(request: Request, env: Env, orderId: number): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
		.bind(orderId, user.id)
		.first();
	if (!order) return error("Order not found", 404);

	await env.DB.prepare("UPDATE orders SET status = 'skipped' WHERE id = ?").bind(orderId).run();
	await env.DB.prepare("UPDATE delivery_tracking SET status = 'skipped' WHERE order_id = ?")
		.bind(orderId)
		.run();
	return json({ message: "Order skipped for selected date", success: true });
}
