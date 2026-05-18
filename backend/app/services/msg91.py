import httpx

from app.config import settings


def format_mobile(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    cc = settings.msg91_country_code
    if len(digits) == 10:
        return f"{cc}{digits}"
    if len(digits) == 12 and digits.startswith(cc):
        return digits
    return f"{cc}{digits}" if len(digits) <= 10 else digits


async def send_otp_sms(phone: str, otp: str) -> tuple[bool, str]:
    if not settings.msg91_auth_key or not settings.msg91_template_id:
        return False, "MSG91 not configured"

    mobile = format_mobile(phone)
    headers = {"Content-Type": "application/json", "authkey": settings.msg91_auth_key}

    # Template: "Your OTP is ##var1##. Do not share it with anyone."
    otp_payload: dict = {
        "template_id": settings.msg91_template_id,
        "mobile": mobile,
        "var1": otp,
        "otp": otp,
    }
    if settings.msg91_sender_id:
        otp_payload["sender"] = settings.msg91_sender_id

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://control.msg91.com/api/v5/otp",
            headers=headers,
            json=otp_payload,
        )
        if resp.is_success and "success" in resp.text.lower():
            return True, "OTP sent via SMS"

        flow_payload: dict = {
            "template_id": settings.msg91_template_id,
            "short_url": "0",
            "recipients": [{"mobiles": mobile, "var1": otp}],
        }
        if settings.msg91_sender_id:
            flow_payload["sender"] = settings.msg91_sender_id

        flow = await client.post(
            "https://control.msg91.com/api/v5/flow/",
            headers=headers,
            json=flow_payload,
        )
        if flow.is_success and "success" in flow.text.lower():
            return True, "OTP sent via SMS"

        params = {
            "authkey": settings.msg91_auth_key,
            "mobile": mobile,
            "otp": otp,
            "otp_expiry": str(settings.otp_expire_minutes),
            "message": f"Your OTP is {otp}. Do not share it with anyone.",
        }
        if settings.msg91_sender_id:
            params["sender"] = settings.msg91_sender_id

        legacy = await client.get("https://api.msg91.com/api/sendotp.php", params=params)
        if legacy.is_success and "success" in legacy.text.lower():
            return True, "OTP sent via SMS"

        return False, flow.text or resp.text or "MSG91 send failed"
