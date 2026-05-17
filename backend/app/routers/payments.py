from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Order, OrderStatus, Payment, PaymentStatus, User
from app.schemas.payment import CreatePaymentRequest, CreatePaymentResponse, PaymentResponse, VerifyPaymentRequest
from app.schemas.common import MessageResponse
from app.services.payment_gateway import create_razorpay_order, verify_razorpay_signature

router = APIRouter(prefix="/api/payment", tags=["Payments"])


@router.post("/create", response_model=CreatePaymentResponse)
def create_payment(body: CreatePaymentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == body.order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    existing = db.query(Payment).filter(Payment.order_id == order.id).first()
    if existing and existing.status == PaymentStatus.success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order already paid")

    amount_paise = int(Decimal(str(order.total_amount)) * 100)
    gateway_data = create_razorpay_order(amount_paise, f"order_{order.id}")

    if existing:
        payment = existing
        payment.payment_method = body.payment_method
        payment.gateway_order_id = gateway_data["order_id"]
        payment.amount = order.total_amount
        payment.status = PaymentStatus.pending
    else:
        payment = Payment(
            order_id=order.id,
            payment_method=body.payment_method,
            gateway_order_id=gateway_data["order_id"],
            amount=order.total_amount,
            status=PaymentStatus.pending,
        )
        db.add(payment)
    db.commit()
    db.refresh(payment)

    return CreatePaymentResponse(
        payment_id=payment.id,
        order_id=order.id,
        amount=Decimal(str(order.total_amount)),
        gateway=gateway_data["gateway"],
        gateway_order_id=gateway_data["order_id"],
        key_id=gateway_data.get("key_id"),
        mock=gateway_data.get("mock", False),
    )


@router.post("/verify", response_model=MessageResponse)
def verify_payment(body: VerifyPaymentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == body.order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    payment = db.query(Payment).filter(Payment.order_id == order.id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if body.payment_method == "razorpay":
        if not verify_razorpay_signature(
            body.razorpay_order_id or "",
            body.razorpay_payment_id or "",
            body.razorpay_signature or "",
        ):
            payment.status = PaymentStatus.failed
            db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment verification failed")
        payment.transaction_id = body.razorpay_payment_id
    else:
        payment.transaction_id = body.transaction_id or f"mock_txn_{order.id}"

    payment.status = PaymentStatus.success
    order.status = OrderStatus.confirmed
    db.commit()
    return MessageResponse(message="Payment verified successfully")


@router.get("/order/{order_id}", response_model=PaymentResponse)
def get_payment(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return payment
