import json
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.database import check_db_connection, fetch_db_sample_data

router = APIRouter(tags=["Health"])


def _db_health_payload() -> dict:
    connected, message, latency_ms = check_db_connection()
    payload: dict = {
        "success": connected,
        "database": "connected" if connected else "disconnected",
        "status": "ok" if connected else "error",
        "message": message,
        "latency_ms": latency_ms,
        "api": "FastAPI",
    }
    if connected:
        try:
            sample = fetch_db_sample_data()
            payload["tables"] = sample["tables"]
            payload["data"] = sample["data"]
        except Exception as exc:
            payload["data_error"] = str(exc)
            payload["data"] = None
    else:
        payload["data"] = None
    return payload


def _render_db_html(payload: dict) -> str:
    status_ok = payload.get("success")
    status_color = "#0E838F" if status_ok else "#c0392b"
    status_text = "connected" if status_ok else "disconnected"
    data_json = json.dumps(payload.get("data") or {}, indent=2, default=str)
    tables_json = json.dumps(payload.get("tables") or {}, indent=2)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fruitzila — DB Health</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }}
    h1 {{ color: {status_color}; }}
    .meta {{ background: #f4f4f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }}
    pre {{ background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; }}
    a {{ color: #0E838F; }}
  </style>
</head>
<body>
  <h1>{"✅" if status_ok else "❌"} MySQL {status_text}</h1>
  <div class="meta">
    <p><strong>API:</strong> FastAPI</p>
    <p><strong>Message:</strong> {payload.get("message", "")}</p>
    <p><strong>Latency:</strong> {payload.get("latency_ms", "—")} ms</p>
    <p><a href="/docs">Open API docs</a> · <a href="/health/db">JSON response</a></p>
  </div>
  <h2>Table row counts</h2>
  <pre>{tables_json}</pre>
  <h2>Database data</h2>
  <pre>{data_json}</pre>
</body>
</html>"""


@router.get("/health")
def api_health():
    return {"status": "healthy", "api": "FastAPI"}


@router.get("/health/db")
def health_db_json():
    """JSON: connection status + all table data."""
    return _db_health_payload()


@router.get("/health/db/view", response_class=HTMLResponse)
def health_db_view():
    """Browser page: connection status + database data."""
    return _render_db_html(_db_health_payload())


@router.get("/api/db/test")
def test_db():
    payload = _db_health_payload()
    if not payload["success"]:
        raise HTTPException(
            status_code=503,
            detail={"database": "disconnected", "message": payload["message"]},
        )
    return payload
