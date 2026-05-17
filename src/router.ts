import { sendOtp, verifyOtp } from "./handlers/auth";
import { listPlans } from "./handlers/plans";
import { getProduct, listProducts } from "./handlers/products";
import { corsPreflight, json } from "./lib/http";

export async function handleApi(request: Request, env: Env): Promise<Response | null> {
	const url = new URL(request.url);
	const { pathname } = url;
	const method = request.method;

	if (method === "OPTIONS" && pathname.startsWith("/api/")) {
		return corsPreflight();
	}

	// Auth
	if (pathname === "/api/auth/send-otp" && method === "POST") {
		return sendOtp(request, env);
	}
	if (pathname === "/api/auth/verify-otp" && method === "POST") {
		return verifyOtp(request, env);
	}

	// Products
	if (pathname === "/api/products" && method === "GET") {
		return listProducts(env);
	}
	const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
	if (productMatch && method === "GET") {
		return getProduct(env, Number(productMatch[1]));
	}

	// Plans
	if (pathname === "/api/plans" && method === "GET") {
		return listPlans(env);
	}

	if (pathname.startsWith("/api/")) {
		return json(
			{
				error: "Not implemented on Worker yet",
				path: pathname,
				method,
				hint: "Use FastAPI backend for full Fruitzila APIs, or request Worker implementation",
			},
			501,
		);
	}

	return null;
}
