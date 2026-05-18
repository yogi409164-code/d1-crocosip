from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginEmailRequest,
    LoginMobileSendOtpRequest,
    LoginMobileVerifyRequest,
    RegisterRequest,
    RegisterResponse,
    SendOtpResponse,
    VerifyPhoneRequest,
)
from app.schemas.common import MessageResponse, TokenResponse
from app.services.google import verify_google_id_token
from app.services.otp import dispatch_otp, generate_otp, validate_otp
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth")


def _token_response(user: User) -> TokenResponse:
    subject = user.email or user.phone
    token = create_access_token(user.id, subject, user.role.value)
    return TokenResponse(access_token=token, user_id=user.id, role=user.role.value)


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


# ─── REGISTER ───────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED, tags=["Register"])
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    email = body.email.lower()

    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=409, detail="Phone already registered. Please login.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered. Please login.")

    user = User(
        name=body.name.strip(),
        phone=phone,
        email=email,
        password_hash=hash_password(body.password),
        role=UserRole.customer,
        phone_verified=False,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    otp = generate_otp()
    ok, message, dev_otp = await dispatch_otp(db, phone, otp)
    return RegisterResponse(
        message="Registered. OTP sent to mobile — verify to complete signup." if ok else message,
        user_id=user.id,
        sms_sent=ok,
        otp=dev_otp,
    )


@router.post("/register/verify-phone", response_model=TokenResponse, tags=["Register"])
def register_verify_phone(body: VerifyPhoneRequest, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Register first.")
    if not validate_otp(db, phone, body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user.phone_verified = True
    db.commit()
    return _token_response(user)


@router.post("/register/google", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED, tags=["Register"])
async def register_google(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not body.phone:
        raise HTTPException(status_code=422, detail="phone is required for signup")
    google = await verify_google_id_token(body.id_token)
    if not google:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    phone = _normalize_phone(body.phone)
    email = google["email"]

    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=409, detail="Phone already registered")
    if db.query(User).filter((User.email == email) | (User.google_id == google["sub"])).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=google["name"],
        phone=phone,
        email=email,
        password_hash=hash_password(body.password) if body.password else None,
        google_id=google["sub"],
        role=UserRole.customer,
        phone_verified=False,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    otp = generate_otp()
    ok, message, dev_otp = await dispatch_otp(db, phone, otp)
    return RegisterResponse(
        message="Google signup — verify mobile OTP.",
        user_id=user.id,
        sms_sent=ok,
        otp=dev_otp,
    )


# ─── LOGIN ──────────────────────────────────────────────────

@router.post("/login/mobile/send-otp", response_model=SendOtpResponse, tags=["Login"])
async def login_mobile_send_otp(body: LoginMobileSendOtpRequest, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    if not db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")
    otp = generate_otp()
    ok, message, dev_otp = await dispatch_otp(db, phone, otp)
    if not ok:
        raise HTTPException(status_code=502, detail=message)
    return SendOtpResponse(message=message, sms_sent=True, otp=dev_otp)


@router.post("/login/mobile/verify", response_model=TokenResponse, tags=["Login"])
def login_mobile_verify(body: LoginMobileVerifyRequest, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")
    if not validate_otp(db, phone, body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user.phone_verified = True
    db.commit()
    return _token_response(user)


@router.post("/login/email", response_model=TokenResponse, tags=["Login"])
def login_email(body: LoginEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")
    if not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_response(user)


@router.post("/login/google", response_model=TokenResponse, tags=["Login"])
async def login_google(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    google = await verify_google_id_token(body.id_token)
    if not google:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    user = db.query(User).filter(
        (User.google_id == google["sub"]) | (User.email == google["email"])
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")

    user.google_id = google["sub"]
    user.email_verified = True
    if not user.name:
        user.name = google["name"]
    db.commit()
    return _token_response(user)


# Legacy
@router.post("/send-otp", response_model=SendOtpResponse, deprecated=True, tags=["Login"])
async def send_otp_legacy(body: LoginMobileSendOtpRequest, db: Session = Depends(get_db)):
    return await login_mobile_send_otp(body, db)


@router.post("/verify-otp", response_model=TokenResponse, deprecated=True, tags=["Login"])
def verify_otp_legacy(body: LoginMobileVerifyRequest, db: Session = Depends(get_db)):
    return login_mobile_verify(body, db)


@router.get("/me", tags=["Profile"])
def get_profile(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role.value,
        "phone_verified": user.phone_verified,
        "email_verified": user.email_verified,
    }


@router.put("/me", response_model=MessageResponse, tags=["Profile"])
def update_profile(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.get("name"):
        user.name = body["name"]
    if body.get("email"):
        user.email = body["email"].lower()
    db.commit()
    return MessageResponse(message="Profile updated")
