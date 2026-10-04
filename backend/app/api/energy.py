from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, status, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.energy import EnergyReadingCreate, EnergyReadingResponse, CSVUploadResponse
from app.services import energy_service, csv_service
from app.utils.datetime_utils import parse_datetime
from app.utils.validation import WattWiseException

router = APIRouter(prefix="/energy", tags=["Energy"])


@router.get("", response_model=List[EnergyReadingResponse], summary="Query energy readings")
def query_energy_readings(
    buildingId: Optional[int] = Query(None, alias="buildingId", description="Building ID filter"),
    building_id: Optional[int] = Query(None, alias="building_id", description="Building ID alias"),
    startDate: Optional[str] = Query(None, alias="startDate", description="Start date ISO string"),
    endDate: Optional[str] = Query(None, alias="endDate", description="End date ISO string"),
    db: Session = Depends(get_db)
):
    target_building_id = buildingId if buildingId is not None else building_id

    start_dt = None
    end_dt = None

    if startDate:
        try:
            start_dt = parse_datetime(startDate)
        except Exception as e:
            raise WattWiseException("INVALID_START_DATE", f"Invalid startDate format: {str(e)}", status_code=400)

    if endDate:
        try:
            end_dt = parse_datetime(endDate)
        except Exception as e:
            raise WattWiseException("INVALID_END_DATE", f"Invalid endDate format: {str(e)}", status_code=400)

    readings = energy_service.get_energy_readings(
        db=db,
        building_id=target_building_id,
        start_date=start_dt,
        end_date=end_dt
    )
    return readings


@router.post("", response_model=EnergyReadingResponse, status_code=status.HTTP_201_CREATED, summary="Create single energy reading")
def create_energy_reading(
    reading_in: EnergyReadingCreate,
    db: Session = Depends(get_db)
):
    return energy_service.create_energy_reading(db, reading_in)


@router.get("/{buildingId}", response_model=List[EnergyReadingResponse], summary="Get energy readings by building ID")
def get_energy_by_building(
    buildingId: int,
    startDate: Optional[str] = Query(None, alias="startDate"),
    endDate: Optional[str] = Query(None, alias="endDate"),
    db: Session = Depends(get_db)
):
    start_dt = parse_datetime(startDate) if startDate else None
    end_dt = parse_datetime(endDate) if endDate else None

    # Validate building exists
    building = energy_service.get_building_by_id(db, buildingId)
    if not building:
        raise HTTPException(status_code=404, detail=f"Building with ID {buildingId} not found")

    return energy_service.get_energy_readings(
        db=db,
        building_id=buildingId,
        start_date=start_dt,
        end_date=end_dt
    )


@router.post("/upload", response_model=CSVUploadResponse, summary="Upload CSV file with energy readings")
async def upload_csv(
    file: UploadFile = File(...),
    building_id: Optional[int] = Form(None),
    buildingId: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    target_building_id = buildingId if buildingId is not None else building_id

    # Check file extension
    if not file.filename.lower().endswith(".csv"):
        raise WattWiseException(
            code="INVALID_FILE_TYPE",
            message="Only CSV files are supported for upload.",
            status_code=400
        )

    content = await file.read()
    return csv_service.process_csv_upload(
        db=db,
        content=content,
        building_id_param=target_building_id
    )
