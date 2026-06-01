from datetime import datetime
from zoneinfo import ZoneInfo

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

def now_vn() -> datetime:
    """Get the current datetime in Vietnam timezone."""
    return datetime.now(VN_TZ)

def to_vn_tz(dt: datetime) -> datetime:
    """Convert a datetime to Vietnam timezone."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=VN_TZ)
    return dt.astimezone(VN_TZ)
