import httpx

from app.config import settings


async def verify_google_id_token(id_token: str) -> dict | None:
    if not id_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
        if not res.is_success:
            return None
        data = res.json()
        if settings.google_client_id and data.get("aud") != settings.google_client_id:
            return None
        if not data.get("email") or data.get("email_verified") == "false":
            return None
        return {
            "sub": data["sub"],
            "email": data["email"].lower(),
            "name": data.get("name") or data["email"].split("@")[0],
        }
    except Exception:
        return None
