from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.utils.datetime_utils import parse_datetime, format_iso


class EnergyReadingCreate(BaseModel):
    building_id: int = Field(..., alias="buildingId")
    timestamp: datetime
    energy_kwh: float = Field(..., alias="energyKwh")
    temperature: Optional[float] = None
    occupancy: Optional[int] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("timestamp", mode="before")
    @classmethod
    def validate_timestamp(cls, v: Any) -> datetime:
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            return parse_datetime(v)
        raise ValueError("Invalid timestamp value")

    @field_validator("energy_kwh")
    @classmethod
    def validate_energy(cls, v: float) -> float:
        if v < 0:
            raise ValueError("energy_kwh cannot be negative")
        return v

    @field_validator("occupancy")
    @classmethod
    def validate_occupancy(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("occupancy cannot be negative")
        return v


class EnergyReadingResponse(BaseModel):
    id: int
    building_id: int = Field(..., serialization_alias="buildingId")
    timestamp: str
    energy_kwh: float = Field(..., serialization_alias="energyKwh")
    temperature: Optional[float] = None
    occupancy: Optional[int] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("timestamp", mode="before")
    @classmethod
    def format_ts(cls, v: Any) -> str:
        if isinstance(v, datetime):
            return format_iso(v)
        return str(v)

    @field_validator("created_at", mode="before")
    @classmethod
    def format_created_at(cls, v: Any) -> Optional[str]:
        if isinstance(v, datetime):
            return format_iso(v)
        return str(v) if v else None


class CSVUploadResponse(BaseModel):
    records_received: int
    records_valid: int
    records_rejected: int
    date_range: Dict[str, Optional[str]]
    building_id: Optional[int]
    processing_status: str
    errors: Optional[List[Dict[str, Any]]] = None
