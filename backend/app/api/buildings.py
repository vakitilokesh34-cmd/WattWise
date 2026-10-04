from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.building import BuildingCreate, BuildingResponse
from app.services import energy_service

router = APIRouter(prefix="/buildings", tags=["Buildings"])


@router.get("", response_model=List[BuildingResponse], summary="List all buildings")
def list_buildings(db: Session = Depends(get_db)):
    return energy_service.get_buildings(db)


@router.post("", response_model=BuildingResponse, status_code=status.HTTP_201_CREATED, summary="Create a new building")
def create_building(building_in: BuildingCreate, db: Session = Depends(get_db)):
    return energy_service.create_building(db, building_in)


@router.get("/{id}", response_model=BuildingResponse, summary="Get building by ID")
def get_building(id: int, db: Session = Depends(get_db)):
    building = energy_service.get_building_by_id(db, id)
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Building with ID {id} not found"
        )
    return building
