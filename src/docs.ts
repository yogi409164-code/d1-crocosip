export function renderSwaggerHtml(specUrl: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fruitzila API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .topbar { display: none !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      const tagOrder = ["Register", "Login", "Profile", "Health", "Products", "Plans", "Orders", "Payments", "Calendar", "Subscription", "Coupons", "Delivery", "Admin"];
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        tagsSorter: (a, b) => tagOrder.indexOf(a) - tagOrder.indexOf(b),
        operationsSorter: "alpha",
      });
    };
  </script>
</body>
</html>`;
}
