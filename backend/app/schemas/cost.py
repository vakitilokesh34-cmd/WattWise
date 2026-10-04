from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class CostImpactBreakdownItem(BaseModel):
    timestamp: str
    actualEnergyKwh: float
    expectedEnergyKwh: float
    excessKwh: float
    tariff: float
    costImpact: float


class CostImpactResponse(BaseModel):
    building_id: Optional[int] = Field(None, serialization_alias="buildingId")
    period: str
    start_date: Optional[str] = Field(None, serialization_alias="startDate")
    end_date: Optional[str] = Field(None, serialization_alias="endDate")
    actual_energy_kwh: float = Field(0.0, serialization_alias="actualEnergyKwh")
    expected_energy_kwh: float = Field(0.0, serialization_alias="expectedEnergyKwh")
    excess_kwh: float = Field(0.0, serialization_alias="excessKwh")
    tariff: float = Field(8.0, serialization_alias="tariff")
    total_cost_impact: float = Field(0.0, serialization_alias="totalCostImpact")
    breakdown: List[CostImpactBreakdownItem] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)
