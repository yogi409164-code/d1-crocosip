from pydantic import BaseModel, Field


class SendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, examples=["9876543210"])


class SendOtpResponse(BaseModel):
    message: str
    success: bool = True
    otp: str | None = None


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=8)
    name: str | None = Field(None, max_length=100)
    email: str | None = Field(None, max_length=100)


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
