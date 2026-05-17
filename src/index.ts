import { renderHtml } from "./renderHtml";

async function checkDb(env: Env): Promise<Response> {
	const start = Date.now();
	try {
		await env.DB.prepare("SELECT 1 AS ok").first();
		const latencyMs = Date.now() - start;

		const { results: comments } = await env.DB.prepare(
			"SELECT * FROM comments ORDER BY id",
		).all();

		const countRow = await env.DB.prepare<{ total: number }>(
			"SELECT COUNT(*) AS total FROM comments",
		).first();

		const { results: tables } = await env.DB.prepare<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
		).all();

		return Response.json({
			success: true,
			database: "connected",
			status: "ok",
			message: "D1 database connected successfully",
			latency_ms: latencyMs,
			database_name: "croco",
			tables: tables.map((t) => t.name),
			row_counts: { comments: countRow?.total ?? 0 },
			data: { comments },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json(
			{
				success: false,
				database: "disconnected",
				status: "error",
				message,
				latency_ms: null,
				data: null,
			},
			{ status: 503 },
		);
	}
}

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);

		if (pathname === "/health/db" || pathname === "/api/db/test") {
			return checkDb(env);
		}

		if (pathname === "/health") {
			return Response.json({ status: "healthy", api: "ok" });
		}

		const stmt = env.DB.prepare("SELECT * FROM comments LIMIT 3");
		const { results } = await stmt.all();

		return new Response(renderHtml(JSON.stringify(results, null, 2)), {
			headers: {
				"content-type": "text/html",
			},
		});
	},
} satisfies ExportedHandler<Env>;
