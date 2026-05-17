from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.plan import PlanResponse


class SubscribeRequest(BaseModel):
    plan_id: int
    start_date: date | None = None


class PauseSubscriptionRequest(BaseModel):
    paused_until: date | None = None


class ResumeSubscriptionRequest(BaseModel):
    pass


class SubscriptionResponse(ORMModel):
    id: int
    user_id: int
    plan_id: int
    start_date: date
    end_date: date | None
    is_paused: bool
    paused_until: date | None
    is_active: bool
    created_at: datetime
    plan: PlanResponse | None = None
    skipped_dates: list[date] = []
