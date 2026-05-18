import { dispatchOtp, validateOtpCode } from "../../lib/auth-otp";
import { createToken, getJwtSecret } from "../../lib/jwt";
import { getGoogleClientId, verifyGoogleIdToken } from "../../lib/google";
import { verifyPassword } from "../../lib/password";
import { error, json, parseJson } from "../../lib/http";

async function tokenResponse(
	env: Env,
	user: { id: number; phone: string; role: string; email: string | null },
) {
	const sub = user.email ?? user.phone;
	const accessToken = await createToken(user.id, sub, user.role, getJwtSecret(env));
	return json({
		access_token: accessToken,
		token_type: "bearer",
		user_id: user.id,
		role: user.role,
	});
}

async function requireRegisteredUser(
	env: Env,
	lookup: { phone?: string; email?: string; google_id?: string },
): Promise<{ id: number; phone: string; role: string; email: string | null; password_hash: string | null } | null> {
	if (lookup.phone) {
		const phone = lookup.phone.replace(/\D/g, "").slice(-10);
		return env.DB.prepare(
			"SELECT id, phone, role, email, password_hash FROM users WHERE phone = ?",
		)
			.bind(phone)
			.first();
	}
	if (lookup.email) {
		return env.DB.prepare(
			"SELECT id, phone, role, email, password_hash FROM users WHERE email = ?",
		)
			.bind(lookup.email.toLowerCase())
			.first();
	}
	return null;
}

function notRegisteredResponse(): Response {
	return error(
		"Account not found. Please sign up first at POST /api/auth/register",
		404,
	);
}

/** POST /api/auth/login/mobile/send-otp */
export async function loginMobileSendOtp(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ phone?: string }>(request);
	if (!body?.phone || body.phone.replace(/\D/g, "").length < 10) {
		return error("Valid phone number is required", 422);
	}

	const phone = body.phone.replace(/\D/g, "").slice(-10);
	if (!(await requireRegisteredUser(env, { phone }))) {
		return notRegisteredResponse();
	}

	return (await dispatchOtp(env, phone)).response;
}

/** POST /api/auth/login/mobile/verify */
export async function loginMobileVerify(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ phone?: string; otp?: string }>(request);
	if (!body?.phone || !body?.otp) return error("phone and otp are required", 422);

	const phone = body.phone.replace(/\D/g, "").slice(-10);
	const user = await requireRegisteredUser(env, { phone });
	if (!user) return notRegisteredResponse();

	if (!(await validateOtpCode(env, phone, body.otp))) {
		return error("Invalid or expired OTP", 400);
	}

	await env.DB.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").bind(user.id).run();
	return tokenResponse(env, user);
}

/** POST /api/auth/login/email */
export async function loginEmail(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ email?: string; password?: string }>(request);
	if (!body?.email || !body?.password) return error("email and password are required", 422);

	const user = await requireRegisteredUser(env, { email: body.email });
	if (!user) return notRegisteredResponse();
	if (!user.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
		return error("Invalid email or password", 401);
	}

	return tokenResponse(env, user);
}

/** POST /api/auth/login/google */
export async function loginGoogle(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ id_token?: string }>(request);
	if (!body?.id_token) return error("id_token is required", 422);

	const google = await verifyGoogleIdToken(body.id_token, getGoogleClientId(env));
	if (!google) return error("Invalid Google token", 401);

	let user = await env.DB.prepare<{
		id: number;
		phone: string;
		role: string;
		email: string | null;
	}>("SELECT id, phone, role, email FROM users WHERE google_id = ?")
		.bind(google.sub)
		.first();

	if (!user) {
		user = await env.DB.prepare<{
			id: number;
			phone: string;
			role: string;
			email: string | null;
		}>("SELECT id, phone, role, email FROM users WHERE email = ?")
			.bind(google.email.toLowerCase())
			.first();
	}

	if (!user) return notRegisteredResponse();

	await env.DB.prepare(
		"UPDATE users SET google_id = ?, email_verified = 1, name = COALESCE(name, ?) WHERE id = ?",
	)
		.bind(google.sub, google.name, user.id)
		.run();

	return tokenResponse(env, user);
}
