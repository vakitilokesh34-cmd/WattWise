from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.utils.datetime_utils import format_iso


class AnomalyResponse(BaseModel):
    id: int
    building_id: int = Field(..., serialization_alias="buildingId")
    energy_reading_id: Optional[int] = Field(None, serialization_alias="energyReadingId")
    timestamp: str
    actual_energy_kwh: float = Field(..., serialization_alias="actualEnergyKwh")
    expected_energy_kwh: float = Field(..., serialization_alias="expectedEnergyKwh")
    excess_kwh: float = Field(..., serialization_alias="excessKwh")
    anomaly_score: float = Field(..., serialization_alias="anomalyScore")
    anomaly_status: str = Field(..., serialization_alias="anomalyStatus")
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


class AnomalyTimelineItem(BaseModel):
    timestamp: str
    actualEnergyKwh: Optional[float] = None
    expectedEnergyKwh: Optional[float] = None
    excessKwh: Optional[float] = None
    anomalyStatus: Optional[str] = None
    temperature: Optional[float] = None
    occupancy: Optional[int] = None


class AnomalyTimelineResponse(BaseModel):
    anomaly: AnomalyResponse
    timeline: List[AnomalyTimelineItem]
