const OTP_LENGTH = 6;
const OTP_EXPIRE_MINUTES = 10;

export function generateOtp(): string {
	return Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

export function otpExpiresAt(): string {
	const d = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);
	return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function hashOtp(otp: string, phone: string, secret: string): Promise<string> {
	const data = new TextEncoder().encode(`${otp}:${phone}:${secret}`);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isExpired(expiresAt: string): boolean {
	return new Date(expiresAt.replace(" ", "T") + "Z") < new Date();
}
