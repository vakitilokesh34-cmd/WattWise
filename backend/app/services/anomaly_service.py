import logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.anomaly import Anomaly
from app.models.energy_reading import EnergyReading
from app.models.baseline import Baseline
from app.schemas.anomaly import AnomalyTimelineResponse, AnomalyResponse, AnomalyTimelineItem
from app.utils.datetime_utils import format_iso
from app.utils.validation import WattWiseException

logger = logging.getLogger("wattwise.anomaly_service")


def get_anomalies(
    db: Session,
    building_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None
) -> List[Anomaly]:
    stmt = select(Anomaly)
    conditions = []

    if building_id is not None:
        conditions.append(Anomaly.building_id == building_id)
    if start_date is not None:
        conditions.append(Anomaly.timestamp >= start_date)
    if end_date is not None:
        conditions.append(Anomaly.timestamp <= end_date)
    if status is not None and status.strip():
        conditions.append(Anomaly.anomaly_status == status.strip())

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(Anomaly.timestamp.desc())
    return list(db.scalars(stmt).all())


def get_anomaly_by_id(db: Session, anomaly_id: int) -> Optional[Anomaly]:
    stmt = select(Anomaly).where(Anomaly.id == anomaly_id)
    return db.scalar(stmt)


def get_anomaly_timeline(
    db: Session,
    anomaly_id: int,
    window_hours: int = 12
) -> AnomalyTimelineResponse:
    anomaly = get_anomaly_by_id(db, anomaly_id)
    if not anomaly:
        raise WattWiseException(
            code="ANOMALY_NOT_FOUND",
            message=f"Anomaly with ID {anomaly_id} does not exist.",
            status_code=404
        )

    ts = anomaly.timestamp
    window_start = ts - timedelta(hours=window_hours)
    window_end = ts + timedelta(hours=window_hours)
    b_id = anomaly.building_id

    # 1. Fetch readings in window
    reading_stmt = select(EnergyReading).where(
        and_(
            EnergyReading.building_id == b_id,
            EnergyReading.timestamp >= window_start,
            EnergyReading.timestamp <= window_end
        )
    ).order_by(EnergyReading.timestamp.asc())
    readings = db.scalars(reading_stmt).all()

    # 2. Fetch baselines in window
    baseline_stmt = select(Baseline).where(
        and_(
            Baseline.building_id == b_id,
            Baseline.timestamp >= window_start,
            Baseline.timestamp <= window_end
        )
    )
    baselines = {b.timestamp: b.expected_energy_kwh for b in db.scalars(baseline_stmt).all()}

    # 3. Fetch anomalies in window
    anomaly_stmt = select(Anomaly).where(
        and_(
            Anomaly.building_id == b_id,
            Anomaly.timestamp >= window_start,
            Anomaly.timestamp <= window_end
        )
    )
    anomalies_map = {a.timestamp: a for a in db.scalars(anomaly_stmt).all()}

    # Combine into timeline
    timeline_items: List[AnomalyTimelineItem] = []
    for r in readings:
        ts_str = format_iso(r.timestamp)
        expected_kwh = baselines.get(r.timestamp)
        anom = anomalies_map.get(r.timestamp)

        excess = None
        anom_status = "normal"

        if anom:
            excess = anom.excess_kwh
            anom_status = anom.anomaly_status
        elif expected_kwh is not None:
            excess = max(0.0, r.energy_kwh - expected_kwh)

        timeline_items.append(
            AnomalyTimelineItem(
                timestamp=ts_str,
                actualEnergyKwh=r.energy_kwh,
                expectedEnergyKwh=expected_kwh,
                excessKwh=excess,
                anomalyStatus=anom_status,
                temperature=r.temperature,
                occupancy=r.occupancy
            )
        )

    anomaly_resp = AnomalyResponse.model_validate(anomaly)

    return AnomalyTimelineResponse(
        anomaly=anomaly_resp,
        timeline=timeline_items
    )
