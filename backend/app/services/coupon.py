from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Coupon


def calculate_discount(db: Session, code: str, order_amount: Decimal) -> tuple[bool, Decimal, str]:
    coupon = db.query(Coupon).filter(Coupon.code == code, Coupon.is_active.is_(True)).first()
    if not coupon:
        return False, Decimal("0"), "Invalid coupon code"
    today = date.today()
    if coupon.valid_from and today < coupon.valid_from:
        return False, Decimal("0"), "Coupon not yet active"
    if coupon.valid_until and today > coupon.valid_until:
        return False, Decimal("0"), "Coupon expired"
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return False, Decimal("0"), "Coupon usage limit reached"
    if order_amount < Decimal(str(coupon.min_order_amount)):
        return False, Decimal("0"), f"Minimum order amount is {coupon.min_order_amount}"

    discount = Decimal("0")
    if coupon.discount_percent:
        discount = (order_amount * Decimal(str(coupon.discount_percent))) / Decimal("100")
    elif coupon.discount_amount:
        discount = Decimal(str(coupon.discount_amount))
    discount = min(discount, order_amount)
    return True, discount, "Coupon applied"
