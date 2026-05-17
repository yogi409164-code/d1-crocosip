from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Coupon, User, UserRole
from app.schemas.coupon import CouponCreate, CouponResponse, CouponValidateRequest, CouponValidateResponse
from app.services.coupon import calculate_discount

router = APIRouter(prefix="/api/coupons", tags=["Coupons & Offers"])


@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(body: CouponValidateRequest, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    valid, discount, message = calculate_discount(db, body.code, body.order_amount)
    return CouponValidateResponse(valid=valid, discount_amount=discount, message=message)


@router.get("", response_model=list[CouponResponse])
def list_active_coupons(db: Session = Depends(get_db)):
    return db.query(Coupon).filter(Coupon.is_active.is_(True)).all()


@router.post("", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
def create_coupon(
    body: CouponCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    if db.query(Coupon).filter(Coupon.code == body.code).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon code already exists")
    coupon = Coupon(**body.model_dump())
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon
