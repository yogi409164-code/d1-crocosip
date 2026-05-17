export async function loadOrderWithItems(db: D1Database, orderId: number) {
	const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
	if (!order) return null;
	const { results: items } = await db
		.prepare(
			`SELECT oi.*, p.name as product_name, p.price as product_price
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
		)
		.bind(orderId)
		.all();
	return { ...order, items };
}

export async function loadUserOrders(db: D1Database, userId: number) {
	const { results: orders } = await db
		.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY delivery_date DESC")
		.bind(userId)
		.all();
	const enriched = [];
	for (const row of orders) {
		const full = await loadOrderWithItems(db, row.id as number);
		if (full) enriched.push(full);
	}
	return enriched;
}
