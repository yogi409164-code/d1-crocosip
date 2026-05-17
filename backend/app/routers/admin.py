from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import Order, Payment, PaymentStatus, User, UserRole

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


@router.get("/analytics")
def user_analytics(
    _: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    total_users = db.query(func.count(User.id)).filter(User.role == UserRole.customer).scalar()
    total_orders = db.query(func.count(Order.id)).scalar()
    revenue = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == PaymentStatus.success)
        .scalar()
    )
    today = date.today()
    orders_today = db.query(func.count(Order.id)).filter(Order.delivery_date == today).scalar()
    return {
        "total_customers": total_users,
        "total_orders": total_orders,
        "total_revenue": float(revenue or 0),
        "deliveries_today": orders_today,
    }


@router.get("/orders/daily")
def daily_order_list(
    delivery_date: date | None = None,
    _: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    target = delivery_date or date.today()
    orders = db.query(Order).filter(Order.delivery_date == target).order_by(Order.status, Order.id).all()
    return [
        {
            "id": o.id,
            "user_id": o.user_id,
            "delivery_date": o.delivery_date,
            "status": o.status.value,
            "total_amount": float(o.total_amount),
        }
        for o in orders
    ]


@router.get("/reports/payments")
def payment_reports(
    days: int = 30,
    _: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)
    payments = (
        db.query(Payment)
        .filter(Payment.created_at >= since)
        .order_by(Payment.created_at.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "order_id": p.order_id,
            "amount": float(p.amount),
            "method": p.payment_method,
            "status": p.status.value,
            "transaction_id": p.transaction_id,
        }
        for p in payments
    ]


@router.get("/reports/orders")
def order_reports(
    days: int = 30,
    _: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)
    orders = db.query(Order).filter(Order.created_at >= since).order_by(Order.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "user_id": o.user_id,
            "delivery_date": o.delivery_date,
            "status": o.status.value,
            "total_amount": float(o.total_amount),
        }
        for o in orders
    ]
