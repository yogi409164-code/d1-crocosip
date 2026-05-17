from datetime import date, timedelta


DELIVERY_SLOT = "06:00-09:00"


def next_delivery_date(from_date: date | None = None) -> date:
    """Book today → delivered next morning."""
    base = from_date or date.today()
    return base + timedelta(days=1)


def is_skipped(skip_dates: list[date], delivery_date: date) -> bool:
    return delivery_date in skip_dates
