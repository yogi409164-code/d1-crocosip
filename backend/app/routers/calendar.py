from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Order, OrderItem, User
from app.schemas.order import OrderResponse

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


@router.get("/orders", response_model=list[OrderResponse])
def get_calendar_orders(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.user_id == user.id)
    )
    if start_date:
        query = query.filter(Order.delivery_date >= start_date)
    if end_date:
        query = query.filter(Order.delivery_date <= end_date)
    return query.order_by(Order.delivery_date.asc()).all()
