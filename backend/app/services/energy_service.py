import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.building import Building
from app.models.energy_reading import EnergyReading
from app.models.baseline import Baseline
from app.models.anomaly import Anomaly
from app.schemas.building import BuildingCreate
from app.schemas.energy import EnergyReadingCreate
from app.utils.validation import WattWiseException
from app.services.ml_service import ml_service

logger = logging.getLogger("wattwise.energy_service")


def create_building(db: Session, building_in: BuildingCreate) -> Building:
    tariff = building_in.tariff if building_in.tariff is not None else 8.00
    building = Building(
        name=building_in.name,
        location=building_in.location,
        tariff=tariff
    )
    db.add(building)
    db.commit()
    db.refresh(building)
    logger.info("Created building ID %s: %s", building.id, building.name)
    return building


def get_buildings(db: Session) -> List[Building]:
    stmt = select(Building).order_by(Building.id)
    return list(db.scalars(stmt).all())


def get_building_by_id(db: Session, building_id: int) -> Optional[Building]:
    stmt = select(Building).where(Building.id == building_id)
    return db.scalar(stmt)


def check_duplicate_reading(db: Session, building_id: int, timestamp: datetime) -> bool:
    stmt = select(EnergyReading.id).where(
        and_(
            EnergyReading.building_id == building_id,
            EnergyReading.timestamp == timestamp
        )
    )
    return db.scalar(stmt) is not None


def create_energy_reading(db: Session, reading_in: EnergyReadingCreate) -> EnergyReading:
    # 1. Validate building exists
    building = get_building_by_id(db, reading_in.building_id)
    if not building:
        raise WattWiseException(
            code="BUILDING_NOT_FOUND",
            message=f"Building with ID {reading_in.building_id} does not exist.",
            status_code=404
        )

    # 2. Check duplicate
    if check_duplicate_reading(db, reading_in.building_id, reading_in.timestamp):
        raise WattWiseException(
            code="DUPLICATE_READING",
            message=f"Energy reading for building {reading_in.building_id} at timestamp {reading_in.timestamp} already exists.",
            status_code=409
        )

    # 3. Create energy reading
    reading = EnergyReading(
        building_id=reading_in.building_id,
        timestamp=reading_in.timestamp,
        energy_kwh=reading_in.energy_kwh,
        temperature=reading_in.temperature,
        occupancy=reading_in.occupancy
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # 4. Optional ML Service integration call
    process_ml_integration(
        db=db,
        reading=reading
    )

    return reading


def process_ml_integration(db: Session, reading: EnergyReading) -> None:
    """
    Pass reading to ML service. If prediction returns, store Baseline and Anomaly.
    """
    prediction = ml_service.predict_energy(
        building_id=reading.building_id,
        timestamp=reading.timestamp,
        actual_energy_kwh=reading.energy_kwh,
        temperature=reading.temperature,
        occupancy=reading.occupancy
    )

    if prediction and "expected_energy_kwh" in prediction:
        expected_kwh = float(prediction["expected_energy_kwh"])
        anomaly_score = float(prediction.get("anomaly_score", 0.0))
        anomaly_status = str(prediction.get("anomaly_status", "normal"))
        excess_kwh = max(0.0, reading.energy_kwh - expected_kwh)

        # Create Baseline
        baseline = Baseline(
            building_id=reading.building_id,
            timestamp=reading.timestamp,
            expected_energy_kwh=expected_kwh,
            source="ml_service"
        )
        db.add(baseline)

        # Create Anomaly record
        anomaly = Anomaly(
            building_id=reading.building_id,
            energy_reading_id=reading.id,
            timestamp=reading.timestamp,
            actual_energy_kwh=reading.energy_kwh,
            expected_energy_kwh=expected_kwh,
            excess_kwh=excess_kwh,
            anomaly_score=anomaly_score,
            anomaly_status=anomaly_status
        )
        db.add(anomaly)
        db.commit()


def get_energy_readings(
    db: Session,
    building_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[EnergyReading]:
    stmt = select(EnergyReading)

    conditions = []
    if building_id is not None:
        conditions.append(EnergyReading.building_id == building_id)
    if start_date is not None:
        conditions.append(EnergyReading.timestamp >= start_date)
    if end_date is not None:
        conditions.append(EnergyReading.timestamp <= end_date)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(EnergyReading.timestamp.asc())
    return list(db.scalars(stmt).all())
