from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole
from app.schemas.auth import ProfileUpdateRequest, SendOtpRequest, SendOtpResponse, VerifyOtpRequest
from app.schemas.common import MessageResponse, TokenResponse
from app.services.otp import generate_otp, store_otp, validate_otp
from app.utils.security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/send-otp", response_model=SendOtpResponse)
def send_otp(body: SendOtpRequest, db: Session = Depends(get_db)):
    otp = generate_otp()
    store_otp(db, body.phone, otp)
    response = SendOtpResponse(message="OTP sent successfully")
    if settings.debug:
        response.otp = otp
    return response


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    if not validate_otp(db, body.phone, body.otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    user = db.query(User).filter(User.phone == body.phone).first()
    if not user:
        user = User(phone=body.phone, name=body.name, email=body.email, role=UserRole.customer)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif body.name or body.email:
        if body.name:
            user.name = body.name
        if body.email:
            user.email = body.email
        db.commit()
    token = create_access_token(user.phone, user.role.value)
    return TokenResponse(access_token=token, user_id=user.id, role=user.role.value)


@router.get("/me")
def get_profile(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role.value,
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
