import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.config.settings import settings
from app.models.building import Building
from app.models.energy_reading import EnergyReading
from app.schemas.energy import CSVUploadResponse
from app.utils.csv_utils import parse_and_validate_csv
from app.utils.datetime_utils import format_iso
from app.utils.validation import WattWiseException
from app.services.energy_service import process_ml_integration

logger = logging.getLogger("wattwise.csv_service")


def process_csv_upload(
    db: Session,
    content: bytes,
    building_id_param: Optional[int] = None
) -> CSVUploadResponse:
    # 1. Enforce file size limit
    max_bytes = settings.MAX_CSV_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise WattWiseException(
            code="FILE_TOO_LARGE",
            message=f"CSV file exceeds the maximum allowed size of {settings.MAX_CSV_SIZE_MB} MB.",
            status_code=413
        )

    # 2. Parse and validate CSV rows
    parsed_rows, rejected_rows = parse_and_validate_csv(
        content=content,
        default_building_id=building_id_param
    )

    records_received = len(parsed_rows) + len(rejected_rows)

    if not parsed_rows:
        return CSVUploadResponse(
            records_received=records_received,
            records_valid=0,
            records_rejected=len(rejected_rows),
            date_range={"start": None, "end": None},
            building_id=building_id_param,
            processing_status="completed",
            errors=rejected_rows
        )

    # 3. Resolve / Validate building IDs
    building_cache: Dict[int, Building] = {}

    def get_or_verify_building(b_id: int) -> Building:
        if b_id in building_cache:
            return building_cache[b_id]
        stmt = select(Building).where(Building.id == b_id)
        b = db.scalar(stmt)
        if not b:
            raise WattWiseException(
                code="BUILDING_NOT_FOUND",
                message=f"Building with ID {b_id} does not exist.",
                status_code=404
            )
        building_cache[b_id] = b
        return b

    # If no building_id present anywhere, get or create a default building
    default_building: Optional[Building] = None
    if building_id_param is not None:
        default_building = get_or_verify_building(building_id_param)
    else:
        # Check if any row provides a building_id
        has_any_building_id = any(r.get("building_id") is not None for r in parsed_rows)
        if not has_any_building_id:
            # Pick first available building or create Default Building
            stmt = select(Building).order_by(Building.id).limit(1)
            default_building = db.scalar(stmt)
            if not default_building:
                default_building = Building(name="Default Building", location="Main Campus", tariff=8.00)
                db.add(default_building)
                db.commit()
                db.refresh(default_building)
            building_cache[default_building.id] = default_building

    # 4. Duplicate detection in DB and within current batch
    valid_records_to_insert = []
    batch_seen_keys = set()

    for row in parsed_rows:
        b_id = row.get("building_id")
        if b_id is None:
            b_id = default_building.id if default_building else None
        else:
            get_or_verify_building(b_id)
            row["building_id"] = b_id

        if row.get("tariff") is not None and b_id in building_cache:
            # Optionally update tariff if provided
            building_cache[b_id].tariff = row["tariff"]

        ts = row["timestamp"]
        key = (b_id, ts)

        # Batch duplicate check
        if key in batch_seen_keys:
            rejected_rows.append({
                "row_num": row["row_num"],
                "code": "DUPLICATE_IN_BATCH",
                "message": f"Row {row['row_num']}: Duplicate timestamp {format_iso(ts)} for building {b_id} within CSV file."
            })
            continue

        # Database duplicate check
        stmt_dup = select(EnergyReading.id).where(
            and_(
                EnergyReading.building_id == b_id,
                EnergyReading.timestamp == ts
            )
        )
        if db.scalar(stmt_dup) is not None:
            rejected_rows.append({
                "row_num": row["row_num"],
                "code": "DUPLICATE_IN_DATABASE",
                "message": f"Row {row['row_num']}: Energy reading for building {b_id} at timestamp {format_iso(ts)} already exists in database."
            })
            continue

        batch_seen_keys.add(key)
        valid_records_to_insert.append(row)

    # 5. Insert valid records
    saved_readings: List[EnergyReading] = []
    for r in valid_records_to_insert:
        reading = EnergyReading(
            building_id=r["building_id"],
            timestamp=r["timestamp"],
            energy_kwh=r["energy_kwh"],
            temperature=r["temperature"],
            occupancy=r["occupancy"]
        )
        db.add(reading)
        saved_readings.append(reading)

    db.commit()

    # Refresh saved readings & process ML integration
    for reading in saved_readings:
        db.refresh(reading)
        process_ml_integration(db=db, reading=reading)

    # Calculate date range
    start_date_str = None
    end_date_str = None
    if valid_records_to_insert:
        timestamps = [r["timestamp"] for r in valid_records_to_insert]
        start_date_str = format_iso(min(timestamps))
        end_date_str = format_iso(max(timestamps))

    target_building_id = building_id_param
    if target_building_id is None and valid_records_to_insert:
        target_building_id = valid_records_to_insert[0]["building_id"]

    logger.info(
        "CSV Upload completed. Received: %s, Valid: %s, Rejected: %s",
        records_received, len(saved_readings), len(rejected_rows)
    )

    return CSVUploadResponse(
        records_received=records_received,
        records_valid=len(saved_readings),
        records_rejected=len(rejected_rows),
        date_range={"start": start_date_str, "end": end_date_str},
        building_id=target_building_id,
        processing_status="completed",
        errors=rejected_rows if rejected_rows else None
    )
