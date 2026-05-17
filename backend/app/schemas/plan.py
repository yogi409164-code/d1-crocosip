from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class PlanCreate(BaseModel):
    plan_name: str = Field(..., max_length=100)
    days: int = Field(..., gt=0)
    price: Decimal = Field(..., gt=0)
    delivery_time: str = "06:00-09:00"


class PlanUpdate(BaseModel):
    plan_name: str | None = None
    days: int | None = None
    price: Decimal | None = None
    delivery_time: str | None = None


class PlanResponse(ORMModel):
    id: int
    plan_name: str
    days: int
    price: Decimal
    delivery_time: str
