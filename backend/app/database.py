from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> tuple[bool, str, float | None]:
    """Run SELECT 1 to verify MySQL is reachable. Returns (ok, message, latency_ms)."""
    from time import perf_counter

    from sqlalchemy import text

    try:
        start = perf_counter()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((perf_counter() - start) * 1000, 2)
        return True, "Database connected successfully", latency_ms
    except Exception as exc:
        return False, str(exc), None
