import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";

export async function createPayment(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<{ order_id: number; payment_method: string }>(request);
	if (!body?.order_id) return error("order_id is required", 422);

	const order = await env.DB.prepare<{ total_amount: number; user_id: number }>(
		"SELECT total_amount, user_id FROM orders WHERE id = ?",
	)
		.bind(body.order_id)
		.first();
	if (!order || order.user_id !== user.id) return error("Order not found", 404);

	const existing = await env.DB.prepare<{ status: string }>(
		"SELECT status FROM payments WHERE order_id = ?",
	)
		.bind(body.order_id)
		.first();
	if (existing?.status === "success") return error("Order already paid", 400);

	const gatewayOrderId = `mock_order_${body.order_id}_${Date.now()}`;
	const method = body.payment_method ?? "razorpay";

	if (existing) {
		await env.DB.prepare(
			"UPDATE payments SET payment_method = ?, transaction_id = ?, status = 'pending' WHERE order_id = ?",
		)
			.bind(method, gatewayOrderId, body.order_id)
			.run();
	} else {
		await env.DB.prepare(
			"INSERT INTO payments (order_id, payment_method, transaction_id, status) VALUES (?, ?, ?, 'pending')",
		)
			.bind(body.order_id, method, gatewayOrderId)
			.run();
	}

	const payment = await env.DB.prepare("SELECT * FROM payments WHERE order_id = ?")
		.bind(body.order_id)
		.first();

	return json({
		payment_id: payment?.id,
		order_id: body.order_id,
		amount: order.total_amount,
		gateway: method,
		gateway_order_id: gatewayOrderId,
		key_id: "mock_key",
		mock: true,
	});
}

export async function verifyPayment(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<{
		order_id: number;
		transaction_id?: string;
		razorpay_payment_id?: string;
	}>(request);
	if (!body?.order_id) return error("order_id is required", 422);

	const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
		.bind(body.order_id, user.id)
		.first();
	if (!order) return error("Order not found", 404);

	const txnId = body.razorpay_payment_id ?? body.transaction_id ?? `mock_txn_${body.order_id}`;
	await env.DB.prepare("UPDATE payments SET status = 'success', transaction_id = ? WHERE order_id = ?")
		.bind(txnId, body.order_id)
		.run();
	await env.DB.prepare("UPDATE orders SET status = 'confirmed' WHERE id = ?").bind(body.order_id).run();

	return json({ message: "Payment verified successfully", success: true });
}

export async function getPayment(request: Request, env: Env, orderId: number): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
		.bind(orderId, user.id)
		.first();
	if (!order) return error("Order not found", 404);

	const payment = await env.DB.prepare("SELECT * FROM payments WHERE order_id = ?")
		.bind(orderId)
		.first();
	if (!payment) return error("Payment not found", 404);
	return json(payment);
}
