const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: CORS_HEADERS });
}

export function error(message: string, status = 400): Response {
	return json({ detail: message, success: false }, status);
}

export function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function parseJson<T>(request: Request): Promise<T | null> {
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
}
