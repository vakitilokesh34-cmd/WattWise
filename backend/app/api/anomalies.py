from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.anomaly import AnomalyResponse, AnomalyTimelineResponse
from app.services import anomaly_service
from app.utils.datetime_utils import parse_datetime

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])


@router.get("", response_model=List[AnomalyResponse], summary="List anomalies with filters")
def list_anomalies(
    buildingId: Optional[int] = Query(None, alias="buildingId"),
    building_id: Optional[int] = Query(None, alias="building_id"),
    startDate: Optional[str] = Query(None, alias="startDate"),
    endDate: Optional[str] = Query(None, alias="endDate"),
    status: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    target_b_id = buildingId if buildingId is not None else building_id
    start_dt = parse_datetime(startDate) if startDate else None
    end_dt = parse_datetime(endDate) if endDate else None

    anomalies = anomaly_service.get_anomalies(
        db=db,
        building_id=target_b_id,
        start_date=start_dt,
        end_date=end_dt,
        status=status
    )
    return anomalies


@router.get("/{id}", response_model=AnomalyResponse, summary="Get anomaly details by ID")
def get_anomaly(id: int, db: Session = Depends(get_db)):
    anomaly = anomaly_service.get_anomaly_by_id(db, id)
    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly with ID {id} not found"
        )
    return anomaly


@router.get("/{id}/timeline", response_model=AnomalyTimelineResponse, summary="Get anomaly contextual timeline")
def get_anomaly_timeline(id: int, db: Session = Depends(get_db)):
    return anomaly_service.get_anomaly_timeline(db=db, anomaly_id=id)
