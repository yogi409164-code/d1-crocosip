import { isResponse, requireAuth } from "../lib/auth";
import { json } from "../lib/http";

export async function analytics(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;

	const customers = await env.DB.prepare(
		"SELECT COUNT(*) as c FROM users WHERE role = 'customer'",
	).first<{ c: number }>();
	const orders = await env.DB.prepare("SELECT COUNT(*) as c FROM orders").first<{ c: number }>();
	const revenue = await env.DB.prepare(
		"SELECT COALESCE(SUM(o.total_amount), 0) as r FROM orders o JOIN payments p ON p.order_id = o.id WHERE p.status = 'success'",
	).first<{ r: number }>();
	const today = new Date().toISOString().slice(0, 10);
	const todayCount = await env.DB.prepare(
		"SELECT COUNT(*) as c FROM orders WHERE delivery_date = ?",
	)
		.bind(today)
		.first<{ c: number }>();

	return json({
		total_customers: customers?.c ?? 0,
		total_orders: orders?.c ?? 0,
		total_revenue: revenue?.r ?? 0,
		deliveries_today: todayCount?.c ?? 0,
	});
}

export async function dailyOrders(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;

	const url = new URL(request.url);
	const deliveryDate = url.searchParams.get("delivery_date") ?? new Date().toISOString().slice(0, 10);

	const { results } = await env.DB.prepare(
		"SELECT id, user_id, delivery_date, status, total_amount FROM orders WHERE delivery_date = ? ORDER BY status, id",
	)
		.bind(deliveryDate)
		.all();

	return json(results);
}

export async function paymentReports(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;

	const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
	const { results } = await env.DB.prepare(
		`SELECT id, order_id, payment_method, transaction_id, status
     FROM payments ORDER BY id DESC LIMIT ?`,
	)
		.bind(days * 10)
		.all();

	return json(results);
}

export async function orderReports(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;

	const { results } = await env.DB.prepare(
		"SELECT id, user_id, delivery_date, status, total_amount FROM orders ORDER BY id DESC LIMIT 100",
	).all();

	return json(results);
}
