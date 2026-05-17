function b64url(data: string): string {
	return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createToken(phone: string, role: string, secret: string): Promise<string> {
	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
	const payload = b64url(JSON.stringify({ sub: phone, role, exp }));
	const data = `${header}.${payload}`;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
	const sigBytes = new Uint8Array(sig);
	const sigStr = b64url(String.fromCharCode(...sigBytes));

	return `${data}.${sigStr}`;
}

export function getJwtSecret(env: Env): string {
	return (env as Env & { JWT_SECRET?: string }).JWT_SECRET ?? "fruitzila-worker-dev-secret";
}
