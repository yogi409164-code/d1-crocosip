from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CreatePaymentRequest(BaseModel):
    order_id: int
    payment_method: str = Field(..., examples=["razorpay", "phonepe"])


class CreatePaymentResponse(BaseModel):
    payment_id: int
    order_id: int
    amount: Decimal
    gateway: str
    gateway_order_id: str
    key_id: str | None = None
    mock: bool = False


class VerifyPaymentRequest(BaseModel):
    order_id: int
    payment_method: str = "razorpay"
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None
    transaction_id: str | None = None


class PaymentResponse(ORMModel):
    id: int
    order_id: int
    payment_method: str
    transaction_id: str | None
    status: str
    amount: Decimal
