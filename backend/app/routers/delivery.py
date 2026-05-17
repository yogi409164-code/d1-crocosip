from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import DeliveryTracking, Order, OrderItem, OrderStatus, User, UserRole
from app.schemas.order import DeliveryTrackingResponse, OrderResponse

router = APIRouter(prefix="/api/delivery", tags=["Delivery Tracking"])


class UpdateDeliveryStatus(BaseModel):
    status: str
    latitude: str | None = None
    longitude: str | None = None


@router.get("/track/{order_id}", response_model=DeliveryTrackingResponse)
def track_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.user_id != user.id and user.role not in (UserRole.admin, UserRole.delivery):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if not order.delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracking not found")
    return order.delivery


@router.put("/track/{order_id}", response_model=DeliveryTrackingResponse)
def update_tracking(
    order_id: int,
    body: UpdateDeliveryStatus,
    user: User = Depends(require_roles(UserRole.delivery, UserRole.admin)),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or not order.delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    tracking = order.delivery
    tracking.status = body.status
    tracking.latitude = body.latitude
    tracking.longitude = body.longitude
    if user.role == UserRole.delivery:
        tracking.delivery_partner_id = user.id
    status_map = {
        "out_for_delivery": OrderStatus.out_for_delivery,
        "delivered": OrderStatus.delivered,
    }
    if body.status in status_map:
        order.status = status_map[body.status]
    db.commit()
    db.refresh(tracking)
    return tracking


@router.get("/today", response_model=list[OrderResponse])
def today_deliveries(
    delivery_date: date | None = None,
    _: User = Depends(require_roles(UserRole.delivery, UserRole.admin)),
    db: Session = Depends(get_db),
):
    target = delivery_date or date.today()
    return (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.delivery_date == target, Order.status.in_([OrderStatus.confirmed, OrderStatus.out_for_delivery]))
        .order_by(Order.id)
        .all()
    )
