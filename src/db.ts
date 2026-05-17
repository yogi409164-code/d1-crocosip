const SYSTEM_TABLE_PREFIXES = ["sqlite_", "_cf_"];

export const FRUITZILA_TABLES = [
	"users",
	"products",
	"subscription_plans",
	"orders",
	"order_items",
	"payments",
] as const;

function isAppTable(name: string): boolean {
	return !SYSTEM_TABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export async function getDbPayload(env: Env) {
	const start = Date.now();
	try {
		await env.DB.prepare("SELECT 1 AS ok").first();
		const latencyMs = Date.now() - start;

		const { results: tableRows } = await env.DB.prepare<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
		).all();

		const appTables = tableRows.map((t) => t.name).filter(isAppTable);
		const row_counts: Record<string, number> = {};
		const data: Record<string, unknown> = {};

		for (const table of appTables) {
			const countRow = await env.DB.prepare<{ total: number }>(
				`SELECT COUNT(*) AS total FROM "${table}"`,
			).first();
			row_counts[table] = countRow?.total ?? 0;

			const { results } = await env.DB.prepare(`SELECT * FROM "${table}" LIMIT 20`).all();
			data[table] = results;
		}

		return {
			success: true,
			database: "connected",
			status: "ok",
			message: "D1 database connected successfully",
			latency_ms: latencyMs,
			database_name: "croco",
			tables: appTables,
			row_counts,
			data,
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
