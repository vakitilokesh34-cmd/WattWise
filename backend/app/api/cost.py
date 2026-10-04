from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.cost import CostImpactResponse
from app.services import cost_service
from app.utils.datetime_utils import parse_datetime

router = APIRouter(prefix="/cost-impact", tags=["Cost Impact"])


@router.get("", response_model=CostImpactResponse, summary="Calculate cost impact of excess energy usage")
def get_cost_impact(
    buildingId: Optional[int] = Query(None, alias="buildingId"),
    building_id: Optional[int] = Query(None, alias="building_id"),
    period: str = Query("weekly", description="Time period: daily, weekly, monthly, custom"),
    startDate: Optional[str] = Query(None, alias="startDate"),
    endDate: Optional[str] = Query(None, alias="endDate"),
    db: Session = Depends(get_db)
):
    target_b_id = buildingId if buildingId is not None else building_id
    start_dt = parse_datetime(startDate) if startDate else None
    end_dt = parse_datetime(endDate) if endDate else None

    return cost_service.get_cost_impact(
        db=db,
        building_id=target_b_id,
        period=period,
        start_date=start_dt,
        end_date=end_dt
    )
