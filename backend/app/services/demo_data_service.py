import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.building import Building
from app.models.energy_reading import EnergyReading
from app.models.baseline import Baseline
from app.models.anomaly import Anomaly


def generate_demo_dataset(
    seed: int = 42,
    building_id: int = 1,
    tariff: float = 8.00,
    days: int = 7
) -> List[Dict[str, Any]]:
    """
    Generates deterministic hourly demo data for the requested number of days.
    Includes normal diurnal patterns and a controlled anomaly:
    Expected = 100 kWh, Actual = 180 kWh, Excess = 80 kWh, Tariff = ₹8/kWh.
    """
    random.seed(seed)

    base_time = datetime(2026, 10, 1, 0, 0, 0, tzinfo=timezone.utc)
    records = []

    # Controlled anomaly target index (e.g. Day 1, 10:00 AM)
    anomaly_day = 0
    anomaly_hour = 10

    total_hours = days * 24

    for h in range(total_hours):
        current_time = base_time + timedelta(hours=h)
        day_index = h // 24
        hour = current_time.hour
        is_weekend = current_time.weekday() in (5, 6)

        # Base temperature profile
        temp = round(20.0 + 8.0 * (1.0 - abs(hour - 14) / 14.0) + random.uniform(-0.5, 0.5), 1)

        # Base occupancy profile
        if is_weekend:
            occ = random.randint(5, 15)
        else:
            if 8 <= hour <= 18:
                occ = random.randint(45, 65)
            elif 6 <= hour < 8 or 18 < hour <= 21:
                occ = random.randint(15, 35)
            else:
                occ = random.randint(2, 8)

        # Baseline expected energy profile
        if is_weekend:
            expected_energy = round(30.0 + random.uniform(-2.0, 2.0), 1)
        else:
            if 0 <= hour < 6:
                expected_energy = round(25.0 + random.uniform(-2.0, 2.0), 1)
            elif 6 <= hour < 9:
                expected_energy = round(60.0 + random.uniform(-3.0, 3.0), 1)
            elif 9 <= hour <= 17:
                expected_energy = 100.0  # Exactly 100 kWh baseline during peak office hour
            elif 17 < hour <= 21:
                expected_energy = round(55.0 + random.uniform(-3.0, 3.0), 1)
            else:
                expected_energy = round(30.0 + random.uniform(-2.0, 2.0), 1)

        # Determine actual energy kWh
        if day_index == anomaly_day and hour == anomaly_hour:
            # Controlled Anomaly!
            expected_energy = 100.0
            actual_energy = 180.0
            anomaly_score = 0.95
            anomaly_status = "anomaly"
        else:
            actual_energy = expected_energy + round(random.uniform(-3.0, 3.0), 1)
            actual_energy = max(10.0, actual_energy)
            anomaly_score = 0.05
            anomaly_status = "normal"

        records.append({
            "building_id": building_id,
            "timestamp": current_time,
            "energy_kwh": actual_energy,
            "expected_energy_kwh": expected_energy,
            "temperature": temp,
            "occupancy": occ,
            "tariff": tariff,
            "anomaly_score": anomaly_score,
            "anomaly_status": anomaly_status
        })

    return records


def seed_demo_data_to_db(db: Session, seed: int = 42) -> Tuple[Building, int, int]:
    """
    Seeds database directly with demo building, energy readings, baselines, and controlled anomaly.
    """
    # 1. Ensure building exists
    building = db.scalar(select(Building).where(Building.id == 1))
    if not building:
        building = Building(id=1, name="Main Building", location="Hyderabad", tariff=8.00)
        db.add(building)
        db.commit()
        db.refresh(building)

    records = generate_demo_dataset(seed=seed, building_id=building.id, tariff=building.tariff)

    readings_added = 0
    anomalies_added = 0

    for rec in records:
        # Check duplicate
        stmt_dup = select(EnergyReading.id).where(
            EnergyReading.building_id == rec["building_id"],
            EnergyReading.timestamp == rec["timestamp"]
        )
        if db.scalar(stmt_dup) is not None:
            continue

        reading = EnergyReading(
            building_id=rec["building_id"],
            timestamp=rec["timestamp"],
            energy_kwh=rec["energy_kwh"],
            temperature=rec["temperature"],
            occupancy=rec["occupancy"]
        )
        db.add(reading)
        db.flush()

        baseline = Baseline(
            building_id=rec["building_id"],
            timestamp=rec["timestamp"],
            expected_energy_kwh=rec["expected_energy_kwh"],
            source="demo_generator"
        )
        db.add(baseline)

        excess_kwh = max(0.0, rec["energy_kwh"] - rec["expected_energy_kwh"])
        if rec["anomaly_status"] != "normal" or excess_kwh > 20.0:
            anomaly = Anomaly(
                building_id=rec["building_id"],
                energy_reading_id=reading.id,
                timestamp=rec["timestamp"],
                actual_energy_kwh=rec["energy_kwh"],
                expected_energy_kwh=rec["expected_energy_kwh"],
                excess_kwh=excess_kwh,
                anomaly_score=rec["anomaly_score"],
                anomaly_status=rec["anomaly_status"]
            )
            db.add(anomaly)
            anomalies_added += 1

        readings_added += 1

    db.commit()
    return building, readings_added, anomalies_added
