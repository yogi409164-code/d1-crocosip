from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Coupon, DeliveryTracking, Order, OrderItem, OrderStatus, Product, User, UserRole
from app.schemas.common import MessageResponse
from app.schemas.order import CreateOrderRequest, OrderResponse, SkipDateRequest
from app.services.coupon import calculate_discount
from app.services.delivery import next_delivery_date

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def _build_order(db: Session, user: User, body: CreateOrderRequest) -> Order:
    delivery_date = body.delivery_date or next_delivery_date()
    subtotal = Decimal("0")
    items_data: list[tuple[Product, int]] = []

    for item in body.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.is_active.is_(True)).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
        subtotal += Decimal(str(product.price)) * item.qty
        items_data.append((product, item.qty))

    discount = Decimal("0")
    if body.coupon_code:
        valid, discount, msg = calculate_discount(db, body.coupon_code, subtotal)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    total = subtotal - discount
    order = Order(
        user_id=user.id,
        plan_id=body.plan_id,
        delivery_date=delivery_date,
        status=OrderStatus.pending,
        total_amount=total,
        coupon_code=body.coupon_code,
        discount_amount=discount,
    )
    db.add(order)
    db.flush()

    for product, qty in items_data:
        db.add(OrderItem(order_id=order.id, product_id=product.id, qty=qty))

    if body.coupon_code and discount > 0:
        coupon = db.query(Coupon).filter(Coupon.code == body.coupon_code).first()
        if coupon:
            coupon.used_count += 1

    db.add(DeliveryTracking(order_id=order.id, status="scheduled"))
    db.commit()
    db.refresh(order)
    return order


@router.post("/create", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(body: CreateOrderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = _build_order(db, user, body)
    return (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order.id)
        .first()
    )


@router.get("/user/{user_id}", response_model=list[OrderResponse])
def user_order_history(
    user_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.id != user_id and user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.user_id == user_id)
        .order_by(Order.delivery_date.desc())
        .all()
    )


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.user_id != user.id and user.role not in (UserRole.admin, UserRole.delivery):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return order


@router.post("/{order_id}/skip", response_model=MessageResponse)
def skip_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    order.status = OrderStatus.skipped
    if order.delivery:
        order.delivery.status = "skipped"
    db.commit()
    return MessageResponse(message="Order skipped for selected date")
