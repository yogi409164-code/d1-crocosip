from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import admin, auth, calendar, coupons, delivery, orders, payments, plans, products, subscription


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Fruitzila API",
    description="Premium fresh juice subscription platform — book today, delivered next morning (6–9 AM).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(plans.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(calendar.router)
app.include_router(subscription.router)
app.include_router(coupons.router)
app.include_router(delivery.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"app": "Fruitzila", "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
