from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ProductCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = None
    price: Decimal = Field(..., gt=0)
    image: str | None = None
    category: str | None = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    image: str | None = None
    category: str | None = None
    is_active: bool | None = None


class ProductResponse(ORMModel):
    id: int
    name: str
    description: str | None
    price: Decimal
    image: str | None
    category: str | None
    is_active: bool
