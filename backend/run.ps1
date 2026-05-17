Set-Location $PSScriptRoot
if (-not (Test-Path ".venv")) { python -m venv .venv }
.\.venv\Scripts\pip install -r requirements.txt -q
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
