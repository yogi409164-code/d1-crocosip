from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):
    message: str
    success: bool = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
