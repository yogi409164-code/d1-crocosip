import { dispatchOtp, validateOtpCode } from "../../lib/auth-otp";
import { createToken, getJwtSecret } from "../../lib/jwt";
import { getGoogleClientId, verifyGoogleIdToken } from "../../lib/google";
import { hashPassword } from "../../lib/password";
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

function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** POST /api/auth/register */
export async function register(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{
		name?: string;
		phone?: string;
		email?: string;
		password?: string;
	}>(request);

	if (!body?.name?.trim()) return error("name is required", 422);
	if (!body?.phone || body.phone.replace(/\D/g, "").length < 10) {
		return error("Valid phone number is required", 422);
	}
	if (!body?.email?.trim() || !validateEmail(body.email)) {
		return error("Valid email is required", 422);
	}
	if (!body?.password || body.password.length < 6) {
		return error("password is required (min 6 characters)", 422);
	}

	const phone = body.phone.replace(/\D/g, "").slice(-10);
	const email = body.email.trim().toLowerCase();

	if (await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first()) {
		return error("Phone already registered. Please login.", 409);
	}
	if (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()) {
		return error("Email already registered. Please login.", 409);
	}

	const passwordHash = await hashPassword(body.password);
	const result = await env.DB.prepare(
		`INSERT INTO users (name, phone, email, role, password_hash, phone_verified, email_verified)
     VALUES (?, ?, ?, 'customer', ?, 0, 0)`,
	)
		.bind(body.name.trim(), phone, email, passwordHash)
		.run();

	const userId = Number(result.meta.last_row_id);
	const otpResult = await dispatchOtp(env, phone);

	return json(
		{
			success: true,
			user_id: userId,
			phone_verified: false,
			sms_sent: otpResult.ok,
			message: otpResult.ok
				? "Registered. OTP sent to your mobile — verify to complete signup."
				: "Registered. Verify phone when SMS is configured.",
			next_step: "POST /api/auth/register/verify-phone",
			...(otpResult.otp ? { otp: otpResult.otp } : {}),
		},
		201,
	);
}

/** POST /api/auth/register/verify-phone */
export async function registerVerifyPhone(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ phone?: string; otp?: string }>(request);
	if (!body?.phone || !body?.otp) return error("phone and otp are required", 422);

	const phone = body.phone.replace(/\D/g, "").slice(-10);
	const user = await env.DB.prepare<{
		id: number;
		phone: string;
		role: string;
		email: string | null;
	}>("SELECT id, phone, role, email FROM users WHERE phone = ?")
		.bind(phone)
		.first();

	if (!user) return error("Account not found. Complete registration first.", 404);
	if (!(await validateOtpCode(env, phone, body.otp))) {
		return error("Invalid or expired OTP", 400);
	}

	await env.DB.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").bind(user.id).run();
	return tokenResponse(env, user);
}

/** POST /api/auth/register/google — name, email from Google + phone required */
export async function registerGoogle(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ id_token?: string; phone?: string; password?: string }>(request);
	if (!body?.id_token) return error("id_token is required", 422);
	if (!body?.phone || body.phone.replace(/\D/g, "").length < 10) {
		return error("phone is required for signup", 422);
	}

	const google = await verifyGoogleIdToken(body.id_token, getGoogleClientId(env));
	if (!google) return error("Invalid Google token", 401);

	const phone = body.phone.replace(/\D/g, "").slice(-10);
	const email = google.email.toLowerCase();

	if (await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first()) {
		return error("Phone already registered. Please login.", 409);
	}
	if (await env.DB.prepare("SELECT id FROM users WHERE email = ? OR google_id = ?")
		.bind(email, google.sub)
		.first()) {
		return error("Email already registered. Please login.", 409);
	}

	const passwordHash = body.password && body.password.length >= 6
		? await hashPassword(body.password)
		: null;

	await env.DB.prepare(
		`INSERT INTO users (name, phone, email, role, password_hash, google_id, phone_verified, email_verified)
     VALUES (?, ?, ?, 'customer', ?, ?, 0, 1)`,
	)
		.bind(google.name, phone, email, passwordHash, google.sub)
		.run();

	const otpResult = await dispatchOtp(env, phone);
	return json(
		{
			success: true,
			message: "Google signup started. Verify mobile OTP to complete.",
			sms_sent: otpResult.ok,
			next_step: "POST /api/auth/register/verify-phone",
			...(otpResult.otp ? { otp: otpResult.otp } : {}),
		},
		201,
	);
}
