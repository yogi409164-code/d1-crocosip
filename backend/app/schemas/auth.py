from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr | None = None
    password: str = Field(..., min_length=6, max_length=128)


class RegisterResponse(BaseModel):
    message: str
    success: bool = True
    user_id: int
    phone_verified: bool = False
    sms_sent: bool = False
    otp: str | None = None
    next_step: str = "POST /api/auth/register/verify-phone"


class VerifyPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=8)


class LoginMobileSendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)


class LoginMobileVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=8)


class LoginEmailRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class SendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)


class SendOtpResponse(BaseModel):
    message: str
    success: bool = True
    sms_sent: bool = True
    otp: str | None = None


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=8)


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
