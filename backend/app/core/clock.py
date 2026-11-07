from datetime import date, datetime
from zoneinfo import ZoneInfo


def local_today(now: datetime, timezone: str) -> date:
    return now.astimezone(ZoneInfo(timezone)).date()
