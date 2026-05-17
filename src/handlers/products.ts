import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";

export async function listProducts(env: Env): Promise<Response> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM products WHERE is_active = 1 ORDER BY name",
	).all();
	return json(results);
}

export async function getProduct(env: Env, id: number): Promise<Response> {
	const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
	if (!product) return error("Product not found", 404);
	return json(product);
}

export async function createProduct(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;
	const body = await parseJson<Record<string, unknown>>(request);
	if (!body?.name || body.price == null) return error("name and price required", 422);
	const result = await env.DB.prepare(
		"INSERT INTO products (name, description, price, image, category, is_active) VALUES (?, ?, ?, ?, ?, 1)",
	)
		.bind(body.name, body.description ?? null, body.price, body.image ?? null, body.category ?? null)
		.run();
	const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?")
		.bind(result.meta.last_row_id)
		.first();
	return json(product, 201);
}

export async function updateProduct(request: Request, env: Env, id: number): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;
	const body = await parseJson<Record<string, unknown>>(request);
	const product = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
	if (!product) return error("Product not found", 404);
	await env.DB.prepare(
		"UPDATE products SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price), image = COALESCE(?, image), category = COALESCE(?, category), is_active = COALESCE(?, is_active) WHERE id = ?",
	)
		.bind(
			body?.name ?? null,
			body?.description ?? null,
			body?.price ?? null,
			body?.image ?? null,
			body?.category ?? null,
			body?.is_active ?? null,
			id,
		)
		.run();
	return json(await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first());
}

export async function deleteProduct(request: Request, env: Env, id: number): Promise<Response> {
	const user = await requireAuth(request, env, ["admin"]);
	if (isResponse(user)) return user;
	await env.DB.prepare("UPDATE products SET is_active = 0 WHERE id = ?").bind(id).run();
	return json({ message: "Product deactivated", success: true });
}
