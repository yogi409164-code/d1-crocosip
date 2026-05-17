import { json } from "../lib/http";

export async function listPlans(env: Env): Promise<Response> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM subscription_plans ORDER BY price",
	).all();
	return json(results);
}
