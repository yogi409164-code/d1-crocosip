import { isResponse, requireAuth } from "../lib/auth";
import { error, json, parseJson } from "../lib/http";
import { createToken, getJwtSecret } from "../lib/jwt";
import { generateOtp, hashOtp, isExpired, otpExpiresAt } from "../lib/otp";

type SendOtpBody = { phone?: string };
type VerifyOtpBody = { phone?: string; otp?: string; name?: string; email?: string };

export async function sendOtp(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<SendOtpBody>(request);
	if (!body?.phone || body.phone.length < 10) {
		return error("Valid phone number is required", 422);
	}

	const otp = generateOtp();
	const otpHash = await hashOtp(otp, body.phone, getJwtSecret(env));
	const expiresAt = otpExpiresAt();

	await env.DB.prepare("DELETE FROM otp_verifications WHERE phone = ? AND verified = 0")
		.bind(body.phone)
		.run();

	await env.DB.prepare(
		"INSERT INTO otp_verifications (phone, otp_hash, expires_at) VALUES (?, ?, ?)",
	)
		.bind(body.phone, otpHash, expiresAt)
		.run();

	return json({
		message: "OTP sent successfully",
		success: true,
		otp,
	});
}

export async function verifyOtp(request: Request, env: Env): Promise<Response> {
	const body = await parseJson<VerifyOtpBody>(request);
	if (!body?.phone || !body?.otp) {
		return error("phone and otp are required", 422);
	}

	const record = await env.DB.prepare<{
		id: number;
		otp_hash: string;
		expires_at: string;
	}>(
		`SELECT id, otp_hash, expires_at FROM otp_verifications
     WHERE phone = ? AND verified = 0
     ORDER BY created_at DESC LIMIT 1`,
	)
		.bind(body.phone)
		.first();

	if (!record) {
		return error("Invalid or expired OTP", 400);
	}
	if (isExpired(record.expires_at)) {
		return error("Invalid or expired OTP", 400);
	}

	const otpHash = await hashOtp(body.otp, body.phone, getJwtSecret(env));
	if (otpHash !== record.otp_hash) {
		return error("Invalid or expired OTP", 400);
	}

	await env.DB.prepare("UPDATE otp_verifications SET verified = 1 WHERE id = ?")
		.bind(record.id)
		.run();

	let user = await env.DB.prepare<{ id: number; role: string }>(
		"SELECT id, role FROM users WHERE phone = ?",
	)
		.bind(body.phone)
		.first();

	if (!user) {
		const result = await env.DB.prepare(
			"INSERT INTO users (name, phone, email, role) VALUES (?, ?, ?, 'customer')",
		)
			.bind(body.name ?? "User", body.phone, body.email ?? null)
			.run();
		user = { id: Number(result.meta.last_row_id), role: "customer" };
	} else if (body.name || body.email) {
		await env.DB.prepare("UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?")
			.bind(body.name ?? null, body.email ?? null, user.id)
			.run();
	}

	const accessToken = await createToken(body.phone, user.role, getJwtSecret(env));

	return json({
		access_token: accessToken,
		token_type: "bearer",
		user_id: user.id,
		role: user.role,
	});
}

export async function getMe(request: Request, env: Env): Promise<Response> {
	const user = await requireAuth(request, env);
	if (isResponse(user)) return user;
	return json({
		id: user.id,
		name: user.name,
		phone: user.phone,
		email: user.email,
		role: user.role,
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
