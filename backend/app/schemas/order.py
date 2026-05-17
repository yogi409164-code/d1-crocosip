from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.product import ProductResponse


class OrderItemInput(BaseModel):
    product_id: int
    qty: int = Field(1, gt=0)


class CreateOrderRequest(BaseModel):
    plan_id: int | None = None
    items: list[OrderItemInput] = Field(..., min_length=1)
    delivery_date: date | None = None
    coupon_code: str | None = None


class OrderItemResponse(ORMModel):
    id: int
    product_id: int
    qty: int
    product: ProductResponse | None = None


class OrderResponse(ORMModel):
    id: int
    user_id: int
    plan_id: int | None
    delivery_date: date
    status: str
    total_amount: Decimal
    coupon_code: str | None
    discount_amount: Decimal
    created_at: datetime
    items: list[OrderItemResponse] = []


class SkipDateRequest(BaseModel):
    skip_date: date


class DeliveryTrackingResponse(ORMModel):
    id: int
    order_id: int
    delivery_partner_id: int | None
    status: str
    latitude: str | None
    longitude: str | None
    updated_at: datetime
