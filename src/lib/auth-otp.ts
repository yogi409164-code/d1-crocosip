import { getJwtSecret } from "./jwt";
import { getMsg91Config, isDevMode, sendOtpSms } from "./msg91";
import { generateOtp, hashOtp, isExpired, otpExpiresAt } from "./otp";
import { error, json } from "./http";

export async function dispatchOtp(
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
					message: "OTP generated (DEV_MODE). Set MSG91_AUTH_KEY for real SMS.",
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
				{
					success: false,
					sms_sent: false,
					message: "MSG91 failed to send SMS",
					detail: sent.message,
				},
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

export async function validateOtpCode(env: Env, phone: string, otp: string): Promise<boolean> {
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
