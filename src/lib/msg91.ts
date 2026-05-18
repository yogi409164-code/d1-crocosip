export type Msg91Config = {
	authKey: string;
	templateId: string;
	senderId?: string;
	countryCode: string;
};

export function getMsg91Config(env: Env): Msg91Config | null {
	const e = env as Env & {
		MSG91_AUTH_KEY?: string;
		MSG91_TEMPLATE_ID?: string;
		MSG91_SENDER_ID?: string;
		MSG91_COUNTRY_CODE?: string;
	};
	if (!e.MSG91_AUTH_KEY?.trim() || !e.MSG91_TEMPLATE_ID?.trim()) {
		return null;
	}
	return {
		authKey: e.MSG91_AUTH_KEY.trim(),
		templateId: e.MSG91_TEMPLATE_ID.trim(),
		senderId: e.MSG91_SENDER_ID?.trim(),
		countryCode: e.MSG91_COUNTRY_CODE ?? "91",
	};
}

export function isDevMode(env: Env): boolean {
	return (env as Env & { DEV_MODE?: string }).DEV_MODE === "true";
}

/** Indian 10-digit → 919876543210 */
export function formatMobile(phone: string, countryCode: string): string {
	const digits = phone.replace(/\D/g, "");
	if (digits.length === 10) return `${countryCode}${digits}`;
	if (digits.length === 12 && digits.startsWith(countryCode)) return digits;
	if (digits.length > 10) return digits;
	return `${countryCode}${digits}`;
}

function parseSuccess(status: number, text: string): boolean {
	const lower = text.toLowerCase();
	if (status < 200 || status >= 300) return false;
	try {
		const data = JSON.parse(text) as { type?: string };
		if (data.type === "error" || data.type === "fail") return false;
	} catch {
		/* not json */
	}
	return lower.includes("success") || status === 200;
}

type AttemptResult = { ok: boolean; detail: string };

async function tryRequest(
	label: string,
	url: string,
	init: RequestInit,
): Promise<AttemptResult> {
	try {
		const response = await fetch(url, init);
		const text = await response.text();
		if (parseSuccess(response.status, text)) {
			return { ok: true, detail: `${label}: ${text.slice(0, 120)}` };
		}
		return { ok: false, detail: `${label} (${response.status}): ${text.slice(0, 200)}` };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, detail: `${label} (network): ${msg}` };
	}
}

/** Template: "Your OTP is ##var1##. Do not share it with anyone." */
export async function sendOtpSms(
	config: Msg91Config,
	phone: string,
	otp: string,
): Promise<{ ok: boolean; message: string; attempts: string[] }> {
	const mobile = formatMobile(phone, config.countryCode);
	const headers = {
		"Content-Type": "application/json",
		authkey: config.authKey,
	};
	const attempts: string[] = [];
	const id = config.templateId;
	const sender = config.senderId ?? "msg91";

	// Flow API (DLT templates with ##var1##)
	const flowRecipients = {
		mobiles: mobile,
		var1: otp,
		VAR1: otp,
	};
	const flowBodies = [
		{ flow_id: id, sender, recipients: [flowRecipients] },
		{ template_id: id, sender, short_url: "0", recipients: [flowRecipients] },
		{ flow_id: id, template_id: id, sender, recipients: [flowRecipients] },
	];

	for (let i = 0; i < flowBodies.length; i++) {
		const r = await tryRequest(
			`flow-v5-${i + 1}`,
			"https://control.msg91.com/api/v5/flow",
			{ method: "POST", headers, body: JSON.stringify(flowBodies[i]) },
		);
		attempts.push(r.detail);
		if (r.ok) return { ok: true, message: "OTP sent via SMS", attempts };
	}

	// OTP API v5
	const otpBodies = [
		{ template_id: id, mobile, var1: otp, otp, sender },
		{ template_id: id, mobile, OTP: otp, sender },
	];
	for (let i = 0; i < otpBodies.length; i++) {
		const r = await tryRequest(
			`otp-v5-${i + 1}`,
			"https://control.msg91.com/api/v5/otp",
			{ method: "POST", headers, body: JSON.stringify(otpBodies[i]) },
		);
		attempts.push(r.detail);
		if (r.ok) return { ok: true, message: "OTP sent via SMS", attempts };
	}

	// Legacy GET
	const params = new URLSearchParams({
		authkey: config.authKey,
		mobile,
		otp,
		otp_expiry: "10",
		otp_length: String(otp.length),
		DLT_TE_ID: id,
		message: `Your OTP is ${otp}. Do not share it with anyone.`,
		sender,
	});
	const legacy = await tryRequest(
		"legacy-sendotp",
		`https://api.msg91.com/api/sendotp.php?${params}`,
		{ method: "GET" },
	);
	attempts.push(legacy.detail);
	if (legacy.ok) return { ok: true, message: "OTP sent via SMS", attempts };

	return {
		ok: false,
		message: attempts[attempts.length - 1] ?? "MSG91 send failed",
		attempts,
	};
}

export function smsConfigStatus(env: Env) {
	const config = getMsg91Config(env);
	return {
		sms_configured: !!config,
		auth_key_set: !!(env as Env & { MSG91_AUTH_KEY?: string }).MSG91_AUTH_KEY?.trim(),
		template_id: (env as Env & { MSG91_TEMPLATE_ID?: string }).MSG91_TEMPLATE_ID ?? null,
		sender_id: (env as Env & { MSG91_SENDER_ID?: string }).MSG91_SENDER_ID ?? null,
		country_code: (env as Env & { MSG91_COUNTRY_CODE?: string }).MSG91_COUNTRY_CODE ?? "91",
		dev_mode: isDevMode(env),
	};
}
