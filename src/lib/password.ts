const ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await deriveKey(password, salt);
	const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
	const keyHex = [...new Uint8Array(key)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `pbkdf2:${saltHex}:${keyHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split(":");
	if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
	const salt = hexToBytes(parts[1]);
	const expected = parts[2];
	const key = await deriveKey(password, salt);
	const keyHex = [...new Uint8Array(key)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return keyHex === expected;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
	return crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		baseKey,
		256,
	);
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}
