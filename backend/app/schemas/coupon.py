from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CouponCreate(BaseModel):
    code: str = Field(..., max_length=50)
    description: str | None = None
    discount_percent: Decimal | None = Field(None, ge=0, le=100)
    discount_amount: Decimal | None = Field(None, ge=0)
    min_order_amount: Decimal = Decimal("0")
    max_uses: int | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    is_active: bool = True


class CouponValidateRequest(BaseModel):
    code: str
    order_amount: Decimal


class CouponResponse(ORMModel):
    id: int
    code: str
    description: str | None
    discount_percent: Decimal | None
    discount_amount: Decimal | None
    min_order_amount: Decimal
    is_active: bool


class CouponValidateResponse(BaseModel):
    valid: bool
    discount_amount: Decimal
    message: str
