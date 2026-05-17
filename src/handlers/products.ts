import { json } from "../lib/http";

export async function listProducts(env: Env): Promise<Response> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM products WHERE is_active = 1 ORDER BY name",
	).all();
	return json(results);
}

export async function getProduct(env: Env, id: number): Promise<Response> {
	const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
	if (!product) {
		return json({ detail: "Product not found" }, 404);
	}
	return json(product);
}
