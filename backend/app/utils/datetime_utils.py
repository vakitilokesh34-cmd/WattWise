from datetime import datetime, timezone
from typing import Optional


def utc_now() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def parse_datetime(dt_input: str) -> datetime:
    """
    Parse an ISO format datetime string into a timezone-aware UTC datetime.
    """
    if not isinstance(dt_input, str):
        raise ValueError("Datetime input must be a string")
    
    clean_str = dt_input.strip()
    if not clean_str:
        raise ValueError("Datetime string cannot be empty")

    # Handle Z suffix
    if clean_str.endswith("Z") or clean_str.endswith("z"):
        clean_str = clean_str[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(clean_str)
    except ValueError as e:
        raise ValueError(f"Invalid ISO datetime format: '{dt_input}'") from e

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt


def format_iso(dt: Optional[datetime]) -> Optional[str]:
    """Format a datetime to standard ISO 8601 string with Z suffix."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
