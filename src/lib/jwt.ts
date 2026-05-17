function b64url(data: string): string {
	return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): string {
	const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
	const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return atob(base64);
}

export type JwtPayload = { sub: string; role: string; exp: number };

export async function createToken(phone: string, role: string, secret: string): Promise<string> {
	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
	const payload = b64url(JSON.stringify({ sub: phone, role, exp }));
	const data = `${header}.${payload}`;
	const sigStr = await sign(data, secret);
	return `${data}.${sigStr}`;
}

async function sign(data: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
	return b64url(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload | null> {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const [header, payload, sig] = parts;
		const data = `${header}.${payload}`;
		const expected = await sign(data, secret);
		if (sig !== expected) return null;
		const decoded = JSON.parse(b64urlDecode(payload)) as JwtPayload;
		if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
		return decoded;
	} catch {
		return null;
	}
}

export function getJwtSecret(env: Env): string {
	return (env as Env & { JWT_SECRET?: string }).JWT_SECRET ?? "fruitzila-worker-dev-secret";
}
