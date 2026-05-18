import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";
import { createToken, getJwtSecret } from "../lib/jwt";
import { getMsg91Config, isDevMode, sendOtpSms, smsConfigStatus } from "../lib/msg91";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateOtp, hashOtp, isExpired, otpExpiresAt } from "../lib/otp";

async function tokenResponse(
	env: Env,
	user: { id: number; phone: string; role: string; email?: string | null },
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

async function dispatchOtp(
	env: Env,
	phone: string,
): Promise<{ ok: boolean; response: Response; otp?: string }> {
	const otp = generateOtp();
	const otpHash = await hashOtp(otp, phone, getJwtSecret(env));
	const expiresAt = otpExpiresAt();

	await env.DB.prepare("DELETE FROM otp_verifications WHERE phone = ? AND verified = 0")
		.bind(phone)
		.run();
	await env.DB.prepare(
		"INSERT INTO otp_verifications (phone, otp_hash, expires_at) VALUES (?, ?, ?)",
	)
		.bind(phone, otpHash, expiresAt)
		.run();

	const msg91 = getMsg91Config(env);
	if (!msg91) {
		if (isDevMode(env)) {
			return {
				ok: true,
				otp,
				response: json({
					success: true,
					sms_sent: false,
					message: "OTP generated (DEV_MODE). Set MSG91_AUTH_KEY for SMS.",
					otp,
				}),
			};
		}
		return {
			ok: false,
			response: error(
				"SMS not configured. Run: npx wrangler secret put MSG91_AUTH_KEY",
				503,
			),
		};
	}

	const sent = await sendOtpSms(msg91, phone, otp);
	if (!sent.ok) {
		return {
			ok: false,
			response: json(
				{ success: false, sms_sent: false, message: "MSG91 failed", detail: sent.message },
				502,
			),
		};
	}

	return {
		ok: true,
		otp: isDevMode(env) ? otp : undefined,
		response: json({
			success: true,
			sms_sent: true,
			message: sent.message,
			...(isDevMode(env) ? { otp } : {}),
		}),
	};
}

async function validateOtpCode(env: Env, phone: string, otp: string): Promise<boolean> {
	const record = await env.DB.prepare<{
		id: number;
		otp_hash: string;
		expires_at: string;
	}>(
		`SELECT id, otp_hash, expires_at FROM otp_verifications
     WHERE phone = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1`,
	)
		.bind(phone)
		.first();
	if (!record || isExpired(record.expires_at)) return false;
	const otpHash = await hashOtp(otp, phone, getJwtSecret(env));
	if (otpHash !== record.otp_hash) return false;
	await env.DB.prepare("UPDATE otp_verifications SET verified = 1 WHERE id = ?")
		.bind(record.id)
		.run();
	return true;
}

// ─── REGISTER ───────────────────────────────────────────────

export async function register(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{
		name?: string;
		phone?: string;
		email?: string;
		password?: string;
	}>(request);

	if (!body?.name || !body?.phone || !body?.password) {
		return error("name, phone and password are required", 422);
	}
	if (body.password.length < 6) {
		return error("Password must be at least 6 characters", 422);
	}
	if (body.phone.length < 10) {
		return error("Valid phone number is required", 422);
	}

	const existingPhone = await env.DB.prepare("SELECT id FROM users WHERE phone = ?")
		.bind(body.phone)
		.first();
	if (existingPhone) {
		return error("Phone number already registered. Please login.", 409);
	}

	if (body.email) {
		const existingEmail = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
			.bind(body.email)
			.first();
		if (existingEmail) {
			return error("Email already registered. Please login.", 409);
		}
	}

	const passwordHash = await hashPassword(body.password);
	const result = await env.DB.prepare(
		`INSERT INTO users (name, phone, email, role, password_hash, phone_verified, email_verified)
     VALUES (?, ?, ?, 'customer', ?, 0, 0)`,
	)
		.bind(body.name, body.phone, body.email ?? null, passwordHash)
		.run();

	const userId = Number(result.meta.last_row_id);
	const otpResult = await dispatchOtp(env, body.phone);

	return json(
		{
			success: true,
			user_id: userId,
			phone_verified: false,
			sms_sent: otpResult.ok,
			message: otpResult.ok
				? "Registered successfully. Verify OTP sent to your phone."
				: "Account created. Configure MSG91 to receive SMS OTP.",
			next_step: "POST /api/auth/register/verify-phone",
			...(otpResult.otp ? { otp: otpResult.otp } : {}),
		},
		201,
	);
}

export async function registerVerifyPhone(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ phone?: string; otp?: string }>(request);
	if (!body?.phone || !body?.otp) {
		return error("phone and otp are required", 422);
	}

	const user = await env.DB.prepare<{ id: number; phone: string; role: string; email: string | null }>(
		"SELECT id, phone, role, email FROM users WHERE phone = ?",
	)
		.bind(body.phone)
		.first();
	if (!user) {
		return error("User not found. Register first.", 404);
	}

	if (!(await validateOtpCode(env, body.phone, body.otp))) {
		return error("Invalid or expired OTP", 400);
	}

	await env.DB.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").bind(user.id).run();

	return tokenResponse(env, user);
}

// ─── LOGIN: MOBILE OTP ──────────────────────────────────────

export async function loginMobileSendOtp(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ phone?: string }>(request);
	if (!body?.phone || body.phone.length < 10) {
		return error("Valid phone number is required", 422);
	}

	const user = await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(body.phone).first();
	if (!user) {
		return error("Account not found. Please register first.", 404);
	}

	const otpResult = await dispatchOtp(env, body.phone);
	return otpResult.response;
}

export async function loginMobileVerify(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ phone?: string; otp?: string }>(request);
	if (!body?.phone || !body?.otp) {
		return error("phone and otp are required", 422);
	}

	const user = await env.DB.prepare<{ id: number; phone: string; role: string; email: string | null }>(
		"SELECT id, phone, role, email FROM users WHERE phone = ?",
	)
		.bind(body.phone)
		.first();
	if (!user) {
		return error("Account not found. Please register first.", 404);
	}

	if (!(await validateOtpCode(env, body.phone, body.otp))) {
		return error("Invalid or expired OTP", 400);
	}

	await env.DB.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").bind(user.id).run();
	return tokenResponse(env, user);
}

// ─── LOGIN: EMAIL + PASSWORD ────────────────────────────────

export async function loginEmail(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<{ email?: string; password?: string }>(request);
	if (!body?.email || !body?.password) {
		return error("email and password are required", 422);
	}

	const user = await env.DB.prepare<{
		id: number;
		phone: string;
		role: string;
		email: string;
		password_hash: string | null;
	}>("SELECT id, phone, role, email, password_hash FROM users WHERE email = ?")
		.bind(body.email)
		.first();

	if (!user || !user.password_hash) {
		return error("Invalid email or password", 401);
	}

	if (!(await verifyPassword(body.password, user.password_hash))) {
		return error("Invalid email or password", 401);
	}

	return tokenResponse(env, user);
}

// ─── LEGACY ALIASES ─────────────────────────────────────────

export const sendOtp = loginMobileSendOtp;
export const verifyOtp = loginMobileVerify;

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
	await env.DB.prepare("UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?")
		.bind(body?.name ?? null, body?.email ?? null, user.id)
		.run();
	return json({ message: "Profile updated", success: true });
}
