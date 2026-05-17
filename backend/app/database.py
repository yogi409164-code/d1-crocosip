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


def _serialize_value(value: object) -> object:
    from datetime import date, datetime
    from decimal import Decimal

    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _serialize_row(row: dict) -> dict:
    return {key: _serialize_value(val) for key, val in row.items()}


def fetch_db_sample_data(limit: int = 50) -> dict:
    """Return row counts and rows from every table."""
    from sqlalchemy import inspect, text

    data: dict = {}
    tables_info: dict[str, int] = {}

    with engine.connect() as conn:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        for table in table_names:
            count = conn.execute(text(f"SELECT COUNT(*) FROM `{table}`")).scalar()
            tables_info[table] = int(count or 0)
            rows = conn.execute(text(f"SELECT * FROM `{table}` LIMIT :lim"), {"lim": limit}).mappings().all()
            data[table] = [_serialize_row(dict(row)) for row in rows]

    return {"tables": tables_info, "data": data}
