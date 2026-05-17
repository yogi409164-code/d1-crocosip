import { getDbPayload } from "./db";
import { handleApi } from "./router";
import { renderDbHealthHtml } from "./renderHtml";

export default {
	async fetch(request, env) {
		const apiResponse = await handleApi(request, env);
		if (apiResponse) {
			return apiResponse;
		}

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
