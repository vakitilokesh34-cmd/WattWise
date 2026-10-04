from typing import Any, Tuple, Optional, Dict
from datetime import datetime
from app.utils.datetime_utils import parse_datetime


class WattWiseException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: Optional[Any] = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def validate_energy_value(val: Any, row_num: Optional[int] = None) -> float:
    row_prefix = f"Row {row_num}: " if row_num is not None else ""
    if val is None or (isinstance(val, str) and not val.strip()):
        raise WattWiseException("MISSING_ENERGY", f"{row_prefix}energy_kwh is required.")
    try:
        fval = float(val)
    except (ValueError, TypeError):
        raise WattWiseException("INVALID_ENERGY_NUMERIC", f"{row_prefix}energy_kwh must be a valid number.")
    
    if fval < 0:
        raise WattWiseException("INVALID_ENERGY_NEGATIVE", f"{row_prefix}energy_kwh cannot be negative.")
    return fval


def validate_occupancy_value(val: Any, row_num: Optional[int] = None) -> Optional[int]:
    if val is None or (isinstance(val, float) and str(val) == "nan") or (isinstance(val, str) and not val.strip()):
        return None
    row_prefix = f"Row {row_num}: " if row_num is not None else ""
    try:
        ival = int(float(val))
    except (ValueError, TypeError):
        raise WattWiseException("INVALID_OCCUPANCY_NUMERIC", f"{row_prefix}occupancy must be a valid integer.")
    if ival < 0:
        raise WattWiseException("INVALID_OCCUPANCY_NEGATIVE", f"{row_prefix}occupancy cannot be negative.")
    return ival


def validate_temperature_value(val: Any, row_num: Optional[int] = None) -> Optional[float]:
    if val is None or (isinstance(val, float) and str(val) == "nan") or (isinstance(val, str) and not val.strip()):
        return None
    row_prefix = f"Row {row_num}: " if row_num is not None else ""
    try:
        return float(val)
    except (ValueError, TypeError):
        raise WattWiseException("INVALID_TEMPERATURE_NUMERIC", f"{row_prefix}temperature must be a valid number.")


def validate_timestamp_value(val: Any, row_num: Optional[int] = None) -> datetime:
    row_prefix = f"Row {row_num}: " if row_num is not None else ""
    if val is None or (isinstance(val, str) and not val.strip()):
        raise WattWiseException("MISSING_TIMESTAMP", f"{row_prefix}timestamp is required.")
    
    if isinstance(val, datetime):
        from datetime import timezone
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
        
    try:
        return parse_datetime(str(val))
    except Exception as e:
        raise WattWiseException("INVALID_TIMESTAMP_FORMAT", f"{row_prefix}Invalid timestamp format '{val}'. Expected ISO 8601 format.") from e
