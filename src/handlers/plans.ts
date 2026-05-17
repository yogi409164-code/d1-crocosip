import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";

export async function listPlans(env: Env): Promise<Response> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM subscription_plans ORDER BY price",
	).all();
	return json(results);
}

export async function getPlan(env: Env, id: number): Promise<Response> {
	const plan = await env.DB.prepare("SELECT * FROM subscription_plans WHERE id = ?")
		.bind(id)
		.first();
	if (!plan) return error("Plan not found", 404);
	return json(plan);
}

export async function createPlan(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;
	const body = await parseJson<Record<string, unknown>>(request);
	if (!body?.plan_name || !body?.days || body.price == null) {
		return error("plan_name, days, price required", 422);
	}
	const result = await env.DB.prepare(
		"INSERT INTO subscription_plans (plan_name, days, price, delivery_time) VALUES (?, ?, ?, ?)",
	)
		.bind(body.plan_name, body.days, body.price, body.delivery_time ?? "06:00-09:00")
		.run();
	const plan = await env.DB.prepare("SELECT * FROM subscription_plans WHERE id = ?")
		.bind(result.meta.last_row_id)
		.first();
	return json(plan, 201);
}

export async function updatePlan(request: Request, env: Env, id: number): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;
	const body = await parseJson<Record<string, unknown>>(request);
	await env.DB.prepare(
		"UPDATE subscription_plans SET plan_name = COALESCE(?, plan_name), days = COALESCE(?, days), price = COALESCE(?, price), delivery_time = COALESCE(?, delivery_time) WHERE id = ?",
	)
		.bind(body?.plan_name ?? null, body?.days ?? null, body?.price ?? null, body?.delivery_time ?? null, id)
		.run();
	return json(await env.DB.prepare("SELECT * FROM subscription_plans WHERE id = ?").bind(id).first());
}

export async function deletePlan(request: Request, env: Env, id: number): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;
	await env.DB.prepare("DELETE FROM subscription_plans WHERE id = ?").bind(id).run();
	return json({ message: "Plan deleted", success: true });
}
