import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";

async function getActiveSub(env: Env, userId: number) {
	return env.DB.prepare("SELECT * FROM user_subscriptions WHERE user_id = ? AND is_active = 1")
		.bind(userId)
		.first();
}

export async function subscribe(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<{ plan_id: number; start_date?: string }>(request);
	if (!body?.plan_id) return error("plan_id is required", 422);

	const plan = await env.DB.prepare<{ days: number }>(
		"SELECT days FROM subscription_plans WHERE id = ?",
	)
		.bind(body.plan_id)
		.first();
	if (!plan) return error("Plan not found", 404);

	await env.DB.prepare("UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ?")
		.bind(user.id)
		.run();

	const start = body.start_date ?? new Date().toISOString().slice(0, 10);
	const endDate = new Date(start);
	endDate.setDate(endDate.getDate() + plan.days);
	const end = endDate.toISOString().slice(0, 10);

	const result = await env.DB.prepare(
		`INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, is_active)
     VALUES (?, ?, ?, ?, 1)`,
	)
		.bind(user.id, body.plan_id, start, end)
		.run();

	const sub = await env.DB.prepare(
		`SELECT us.*, sp.plan_name, sp.days, sp.price, sp.delivery_time
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     WHERE us.id = ?`,
	)
		.bind(result.meta.last_row_id)
		.first();

	return json(sub, 201);
}

export async function activeSubscription(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const sub = await env.DB.prepare(
		`SELECT us.*, sp.plan_name, sp.days, sp.price, sp.delivery_time
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = ? AND us.is_active = 1
     ORDER BY us.created_at DESC LIMIT 1`,
	)
		.bind(user.id)
		.first();

	return json(sub ?? null);
}

export async function pauseSubscription(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<{ paused_until?: string }>(request);
	const sub = await getActiveSub(env, user.id);
	if (!sub) return error("No active subscription", 404);

	await env.DB.prepare(
		"UPDATE user_subscriptions SET is_paused = 1, paused_until = ? WHERE id = ?",
	)
		.bind(body?.paused_until ?? null, sub.id)
		.run();

	return json({ message: "Subscription paused", success: true });
}

export async function resumeSubscription(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const sub = await getActiveSub(env, user.id);
	if (!sub) return error("No active subscription", 404);

	await env.DB.prepare(
		"UPDATE user_subscriptions SET is_paused = 0, paused_until = NULL WHERE id = ?",
	)
		.bind(sub.id)
		.run();

	return json({ message: "Subscription resumed", success: true });
}

export async function skipSubscriptionDate(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;

	const body = await parseJson<{ skip_date: string }>(request);
	if (!body?.skip_date) return error("skip_date is required", 422);

	const sub = await getActiveSub(env, user.id);
	if (!sub) return error("No active subscription", 404);

	await env.DB.prepare(
		"INSERT OR IGNORE INTO subscription_skip_dates (subscription_id, skip_date) VALUES (?, ?)",
	)
		.bind(sub.id, body.skip_date)
		.run();

	return json({ message: "Delivery skipped for selected date", success: true });
}
