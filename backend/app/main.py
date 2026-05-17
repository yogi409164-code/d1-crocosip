from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, check_db_connection, engine
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
    return {"status": "healthy", "api": "ok"}


@app.get("/health/db")
def health_db():
    """Test whether MySQL is connected and responding."""
    connected, message, latency_ms = check_db_connection()
    return {
        "database": "connected" if connected else "disconnected",
        "status": "ok" if connected else "error",
        "message": message,
        "latency_ms": latency_ms,
    }


@app.get("/api/db/test")
def test_db():
    """Alias for DB connectivity check (for mobile/admin tools)."""
    connected, message, latency_ms = check_db_connection()
    if not connected:
        raise HTTPException(
            status_code=503,
            detail={
                "database": "disconnected",
                "message": message,
            },
        )
    return {
        "success": True,
        "database": "connected",
        "message": message,
        "latency_ms": latency_ms,
    }
