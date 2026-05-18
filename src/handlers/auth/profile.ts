import { isResponse, requireAuth } from "../../lib/auth";
import { smsConfigStatus } from "../../lib/msg91";
import { error, json, parseJson } from "../../lib/http";

export async function smsStatus(_request: Request, env: Env): Promise<Response> {
	return json(smsConfigStatus(env));
}

export async function getMe(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;
	const row = await env.DB.prepare<{ phone_verified: number; email_verified: number }>(
		"SELECT phone_verified, email_verified FROM users WHERE id = ?",
	)
		.bind(user.id)
		.first();
	return json({
		id: user.id,
		name: user.name,
		phone: user.phone,
		email: user.email,
		role: user.role,
		phone_verified: !!row?.phone_verified,
		email_verified: !!row?.email_verified,
	});
}

export async function updateMe(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;
	const body = await parseJson<{ name?: string; email?: string }>(request);
	if (body?.email) {
		const taken = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
			.bind(body.email.toLowerCase(), user.id)
			.first();
		if (taken) return error("Email already in use", 409);
	}
	await env.DB.prepare(
		"UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?",
	)
		.bind(body?.name ?? null, body?.email?.toLowerCase() ?? null, user.id)
		.run();
	return json({ message: "Profile updated", success: true });
}
