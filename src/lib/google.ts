export type GoogleUser = {
	sub: string;
	email: string;
	name: string;
	picture?: string;
};

export async function verifyGoogleIdToken(
	idToken: string,
	clientId: string | undefined,
): Promise<GoogleUser | null> {
	try {
		const res = await fetch(
			`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
		);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			sub: string;
			email: string;
			name?: string;
			aud?: string;
			email_verified?: string;
		};
		if (clientId && data.aud !== clientId) return null;
		if (!data.email || data.email_verified === "false") return null;
		return {
			sub: data.sub,
			email: data.email,
			name: data.name ?? data.email.split("@")[0],
		};
	} catch {
		return null;
	}
}

export function getGoogleClientId(env: Env): string | undefined {
	return (env as Env & { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID;
}
