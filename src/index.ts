import { renderDbHealthHtml } from "./renderHtml";

type DbPayload = {
	success: boolean;
	database: string;
	status: string;
	message: string;
	latency_ms: number | null;
	database_name?: string;
	tables?: string[];
	row_counts?: Record<string, number>;
	data?: Record<string, unknown> | null;
};

async function getDbPayload(env: Env): Promise<DbPayload> {
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

		return {
			success: true,
			database: "connected",
			status: "ok",
			message: "D1 database connected successfully",
			latency_ms: latencyMs,
			database_name: "croco",
			tables: tables.map((t) => t.name),
			row_counts: { comments: countRow?.total ?? 0 },
			data: { comments },
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			database: "disconnected",
			status: "error",
			message,
			latency_ms: null,
			data: null,
		};
	}
}

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);

		if (pathname === "/health/db" || pathname === "/api/db/test") {
			const payload = await getDbPayload(env);
			if (!payload.success && pathname === "/api/db/test") {
				return Response.json(payload, { status: 503 });
			}
			return Response.json(payload);
		}

		if (pathname === "/health/db/view") {
			const payload = await getDbPayload(env);
			return new Response(renderDbHealthHtml(payload), {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		if (pathname === "/health") {
			return Response.json({ status: "healthy", api: "ok" });
		}

		if (pathname === "/") {
			return Response.redirect(new URL("/health/db/view", request.url), 302);
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
