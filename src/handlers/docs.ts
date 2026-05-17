import { getOpenApiSpec } from "../openapi";
import { renderSwaggerHtml } from "../docs";
import { json } from "../lib/http";

const HTML_HEADERS = {
	"content-type": "text/html; charset=utf-8",
	"Access-Control-Allow-Origin": "*",
};

export function openApiJson(request: Request): Response {
	const origin = new URL(request.url).origin;
	return json(getOpenApiSpec(origin));
}

export function swaggerUi(request: Request): Response {
	const origin = new URL(request.url).origin;
	const specUrl = `${origin}/openapi.json`;
	return new Response(renderSwaggerHtml(specUrl), { headers: HTML_HEADERS });
}

export function redocUi(request: Request): Response {
	const origin = new URL(request.url).origin;
	const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Fruitzila API — ReDoc</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>body { margin: 0; padding: 0; }</style>
</head>
<body>
  <redoc spec-url="${origin}/openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;
	return new Response(html, { headers: HTML_HEADERS });
}
