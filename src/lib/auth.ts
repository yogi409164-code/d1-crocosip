import { error } from "./http";
import { getJwtSecret, verifyToken } from "./jwt";

export type AuthUser = {
	id: number;
	phone: string;
	name: string;
	email: string | null;
	role: string;
};

export async function requireAuth(
	request: Request,
	env: Env,
	roles?: string[],
): Promise<AuthUser | Response> {
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return error("Not authenticated", 401);
	}
	const token = header.slice(7);
	const payload = await verifyToken(token, getJwtSecret(env));
	if (!payload) {
		return error("Invalid or expired token", 401);
	}

	let user = null;
	if (payload.uid) {
		user = await env.DB.prepare<AuthUser>(
			"SELECT id, phone, name, email, role FROM users WHERE id = ?",
		)
			.bind(payload.uid)
			.first();
	}
	if (!user) {
		user = await env.DB.prepare<AuthUser>(
			"SELECT id, phone, name, email, role FROM users WHERE phone = ? OR email = ?",
		)
			.bind(payload.sub, payload.sub)
			.first();
	}
	if (!user) {
		return error("User not found", 401);
	}
	if (roles && !roles.includes(user.role)) {
		return error("Insufficient permissions", 403);
	}
	return user;
}

export function isResponse(v: AuthUser | Response): v is Response {
	return v instanceof Response;
}
