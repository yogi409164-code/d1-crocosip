import { isResponse, requireAuth } from "../lib/auth";
import { json } from "../lib/http";
import { loadOrderWithItems } from "../lib/orders";

export async function calendarOrders(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const url = new URL(request.url);
	const startDate = url.searchParams.get("start_date");
	const endDate = url.searchParams.get("end_date");

	let query = "SELECT id FROM orders WHERE user_id = ?";
	const binds: (string | number)[] = [user.id];

	if (startDate) {
		query += " AND delivery_date >= ?";
		binds.push(startDate);
	}
	if (endDate) {
		query += " AND delivery_date <= ?";
		binds.push(endDate);
	}
	query += " ORDER BY delivery_date ASC";

	const { results } = await env.DB.prepare(query)
		.bind(...binds)
		.all();

	const orders = [];
	for (const row of results) {
		const full = await loadOrderWithItems(env.DB, row.id as number);
		if (full) orders.push(full);
	}
	return json(orders);
}
