from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BuildingBase(BaseModel):
    name: str = Field(..., description="Name of the building", json_schema_extra={"example": "Main Building"})
    location: str = Field(..., description="Building location", json_schema_extra={"example": "Hyderabad"})
    tariff: float = Field(default=8.00, description="Electricity tariff per kWh", json_schema_extra={"example": 8.00})


class BuildingCreate(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Main Building"})
    location: str = Field(..., json_schema_extra={"example": "Hyderabad"})
    tariff: Optional[float] = Field(default=8.00, json_schema_extra={"example": 8.00})


class BuildingResponse(BuildingBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
