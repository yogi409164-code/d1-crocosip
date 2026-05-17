export function renderDbHealthHtml(payload: {
	success: boolean;
	database: string;
	message: string;
	latency_ms: number | null;
	database_name?: string;
	tables?: string[];
	row_counts?: Record<string, number>;
	data?: Record<string, unknown> | null;
}) {
	const ok = payload.success;
	const statusColor = ok ? "#0E838F" : "#c0392b";
	const dataJson = JSON.stringify(payload.data ?? {}, null, 2);
	const tablesJson = JSON.stringify(payload.row_counts ?? {}, null, 2);
	const tableList = (payload.tables ?? []).join(", ") || "—";

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>D1 Health — croco</title>
  <link rel="stylesheet" type="text/css" href="https://static.integrations.cloudflare.com/styles.css">
  <style>
    .status-ok { color: ${statusColor}; }
    .meta { margin: 1rem 0; }
    pre code { display: block; white-space: pre-wrap; }
  </style>
</head>
<body>
  <header>
    <img src="https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/30e0d3f6-6076-40f8-7abb-8a7676f83c00/public" alt="" />
    <h1 class="status-ok">${ok ? "✅" : "❌"} D1 ${payload.database}</h1>
  </header>
  <main>
    <div class="meta">
      <p><strong>Database:</strong> ${payload.database_name ?? "croco"}</p>
      <p><strong>Message:</strong> ${payload.message}</p>
      <p><strong>Latency:</strong> ${payload.latency_ms ?? "—"} ms</p>
      <p><strong>Tables:</strong> ${tableList}</p>
      <p>
        <a href="/health/db">JSON</a> ·
        <a href="/health/db/view">Refresh</a> ·
        <a href="/">Home</a>
      </p>
    </div>
    <h2>Row counts</h2>
    <pre><code>${tablesJson}</code></pre>
    <h2>Data</h2>
    <pre><code><span style="color: #0E838F">&gt; </span>SELECT * FROM comments;<br>${dataJson}</code></pre>
  </main>
</body>
</html>`;
}
