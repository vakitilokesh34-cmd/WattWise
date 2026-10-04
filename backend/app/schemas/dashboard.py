from typing import Optional
from pydantic import BaseModel, ConfigDict


class DashboardSummary(BaseModel):
    currentUsage: Optional[float] = None
    expectedUsage: Optional[float] = None
    excessEnergy: Optional[float] = None
    estimatedExcessCost: Optional[float] = None
    activeAnomalies: int = 0
    energyEfficiency: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True)
