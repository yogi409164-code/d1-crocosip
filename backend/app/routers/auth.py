from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole
from app.schemas.auth import (
    LoginEmailRequest,
    LoginMobileSendOtpRequest,
    LoginMobileVerifyRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    RegisterResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyPhoneRequest,
)
from app.schemas.common import MessageResponse, TokenResponse
from app.services.otp import dispatch_otp, generate_otp, validate_otp
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _token_response(user: User) -> TokenResponse:
    subject = user.email or user.phone
    token = create_access_token(user.id, subject, user.role.value)
    return TokenResponse(access_token=token, user_id=user.id, role=user.role.value)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone == body.phone).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone already registered")
    if body.email and db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        name=body.name,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.customer,
        phone_verified=False,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    otp = generate_otp()
    ok, message, dev_otp = await dispatch_otp(db, body.phone, otp)

    return RegisterResponse(
        message="Registered successfully. Verify OTP sent to your phone." if ok else message,
        user_id=user.id,
        sms_sent=ok,
        otp=dev_otp,
    )


@router.post("/register/verify-phone", response_model=TokenResponse)
def register_verify_phone(body: VerifyPhoneRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == body.phone).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found. Register first.")
    if not validate_otp(db, body.phone, body.otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    user.phone_verified = True
    db.commit()
    return _token_response(user)


@router.post("/login/mobile/send-otp", response_model=SendOtpResponse)
async def login_mobile_send_otp(body: LoginMobileSendOtpRequest, db: Session = Depends(get_db)):
    if not db.query(User).filter(User.phone == body.phone).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found. Register first.")
    otp = generate_otp()
    ok, message, dev_otp = await dispatch_otp(db, body.phone, otp)
    if not ok:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)
    return SendOtpResponse(message=message, sms_sent=True, otp=dev_otp)


@router.post("/login/mobile/verify", response_model=TokenResponse)
def login_mobile_verify(body: LoginMobileVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == body.phone).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found. Register first.")
    if not validate_otp(db, body.phone, body.otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    user.phone_verified = True
    db.commit()
    return _token_response(user)


@router.post("/login/email", response_model=TokenResponse)
def login_email(body: LoginEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _token_response(user)


@router.post("/send-otp", response_model=SendOtpResponse, deprecated=True)
async def send_otp_legacy(body: SendOtpRequest, db: Session = Depends(get_db)):
    return await login_mobile_send_otp(LoginMobileSendOtpRequest(phone=body.phone), db)


@router.post("/verify-otp", response_model=TokenResponse, deprecated=True)
def verify_otp_legacy(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    return login_mobile_verify(LoginMobileVerifyRequest(phone=body.phone, otp=body.otp), db)


@router.get("/me")
def get_profile(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role.value,
        "phone_verified": user.phone_verified,
        "email_verified": user.email_verified,
        "created_at": user.created_at,
    }


@router.put("/me", response_model=MessageResponse)
def update_profile(body: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name
    if body.email is not None:
        user.email = body.email
    db.commit()
    return MessageResponse(message="Profile updated")
