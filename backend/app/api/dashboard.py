from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary, summary="Get dashboard summary metrics")
def get_summary(
    buildingId: Optional[int] = Query(None, alias="buildingId"),
    building_id: Optional[int] = Query(None, alias="building_id"),
    db: Session = Depends(get_db)
):
    target_building_id = buildingId if buildingId is not None else building_id
    return dashboard_service.get_dashboard_summary(db=db, building_id=target_building_id)
