from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import SubscriptionPlan, SubscriptionSkipDate, User, UserSubscription
from app.schemas.common import MessageResponse
from app.schemas.order import SkipDateRequest
from app.schemas.subscription import (
    PauseSubscriptionRequest,
    SubscribeRequest,
    SubscriptionResponse,
)

router = APIRouter(prefix="/api/subscription", tags=["Subscription"])


@router.post("/subscribe", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe(body: SubscribeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == body.plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    active = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user.id, UserSubscription.is_active.is_(True))
        .first()
    )
    if active:
        active.is_active = False
        db.flush()

    start = body.start_date or date.today()
    end = start + timedelta(days=plan.days)
    sub = UserSubscription(user_id=user.id, plan_id=plan.id, start_date=start, end_date=end, is_active=True)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return _load_subscription(db, sub.id)


@router.get("/active", response_model=SubscriptionResponse | None)
def get_active_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user.id, UserSubscription.is_active.is_(True))
        .order_by(UserSubscription.created_at.desc())
        .first()
    )
    if not sub:
        return None
    return _load_subscription(db, sub.id)


@router.post("/pause", response_model=MessageResponse)
def pause_subscription(
    body: PauseSubscriptionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_sub(db, user.id)
    sub.is_paused = True
    sub.paused_until = body.paused_until
    db.commit()
    return MessageResponse(message="Subscription paused")


@router.post("/resume", response_model=MessageResponse)
def resume_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = _get_active_sub(db, user.id)
    sub.is_paused = False
    sub.paused_until = None
    db.commit()
    return MessageResponse(message="Subscription resumed")


@router.post("/skip-date", response_model=MessageResponse)
def skip_date(body: SkipDateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = _get_active_sub(db, user.id)
    exists = (
        db.query(SubscriptionSkipDate)
        .filter(SubscriptionSkipDate.subscription_id == sub.id, SubscriptionSkipDate.skip_date == body.skip_date)
        .first()
    )
    if exists:
        return MessageResponse(message="Date already skipped")
    db.add(SubscriptionSkipDate(subscription_id=sub.id, skip_date=body.skip_date))
    db.commit()
    return MessageResponse(message="Delivery skipped for selected date")


def _get_active_sub(db: Session, user_id: int) -> UserSubscription:
    sub = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user_id, UserSubscription.is_active.is_(True))
        .first()
    )
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active subscription")
    return sub


def _load_subscription(db: Session, sub_id: int) -> SubscriptionResponse:
    sub = (
        db.query(UserSubscription)
        .options(joinedload(UserSubscription.plan), joinedload(UserSubscription.skipped_dates))
        .filter(UserSubscription.id == sub_id)
        .first()
    )
    skipped = [s.skip_date for s in sub.skipped_dates]
    data = SubscriptionResponse.model_validate(sub)
    data.skipped_dates = skipped
    return data
