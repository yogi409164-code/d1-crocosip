import { renderHtml } from "./renderHtml";

async function checkDb(env: Env): Promise<Response> {
	const start = Date.now();
	try {
		await env.DB.prepare("SELECT 1 AS ok").first();
		const latencyMs = Date.now() - start;
		return Response.json({
			success: true,
			database: "connected",
			status: "ok",
			message: "D1 database connected successfully",
			latency_ms: latencyMs,
			database_name: "croco",
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
