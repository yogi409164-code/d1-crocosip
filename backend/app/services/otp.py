import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models import OtpVerification
from app.utils.security import hash_otp, verify_otp


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=settings.otp_length))


async def dispatch_otp(db: Session, phone: str, otp: str) -> tuple[bool, str, str | None]:
    """Store OTP and send via MSG91 if configured. Returns (success, message, dev_otp)."""
    from app.services.msg91 import send_otp_sms

    store_otp(db, phone, otp)
    if settings.msg91_auth_key and settings.msg91_template_id:
        ok, msg = await send_otp_sms(phone, otp)
        return ok, msg, None
    if settings.debug:
        return True, "OTP sent successfully (dev mode)", otp
    return False, "SMS provider not configured", None


def store_otp(db: Session, phone: str, otp: str) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)
    db.query(OtpVerification).filter(OtpVerification.phone == phone, OtpVerification.verified.is_(False)).delete()
    record = OtpVerification(phone=phone, otp_hash=hash_otp(otp), expires_at=expires_at.replace(tzinfo=None))
    db.add(record)
    db.commit()


def validate_otp(db: Session, phone: str, otp: str) -> bool:
    record = (
        db.query(OtpVerification)
        .filter(OtpVerification.phone == phone, OtpVerification.verified.is_(False))
        .order_by(OtpVerification.created_at.desc())
        .first()
    )
    if not record:
        return False
    if record.expires_at < datetime.utcnow():
        return False
    if not verify_otp(otp, record.otp_hash):
        return False
    record.verified = True
    db.commit()
    return True
