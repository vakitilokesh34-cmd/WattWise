import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func

from app.models.building import Building
from app.models.energy_reading import EnergyReading
from app.models.baseline import Baseline
from app.models.anomaly import Anomaly
from app.schemas.dashboard import DashboardSummary

logger = logging.getLogger("wattwise.dashboard_service")


def get_dashboard_summary(
    db: Session,
    building_id: Optional[int] = None
) -> DashboardSummary:
    """
    Computes dashboard summary metrics using actual stored energy readings,
    baselines, anomalies, and building tariff information.
    """
    # 1. Get latest energy reading
    reading_stmt = select(EnergyReading)
    if building_id is not None:
        reading_stmt = reading_stmt.where(EnergyReading.building_id == building_id)
    reading_stmt = reading_stmt.order_by(EnergyReading.timestamp.desc()).limit(1)

    latest_reading = db.scalar(reading_stmt)

    if not latest_reading:
        # No energy data exists yet
        return DashboardSummary(
            currentUsage=None,
            expectedUsage=None,
            excessEnergy=None,
            estimatedExcessCost=None,
            activeAnomalies=0,
            energyEfficiency=None
        )

    current_usage = float(latest_reading.energy_kwh)
    b_id = latest_reading.building_id

    # 2. Get baseline for latest reading's building and timestamp
    baseline_stmt = select(Baseline.expected_energy_kwh).where(
        and_(
            Baseline.building_id == b_id,
            Baseline.timestamp == latest_reading.timestamp
        )
    ).limit(1)
    expected_usage_val = db.scalar(baseline_stmt)

    # 3. Get building tariff
    building_stmt = select(Building.tariff).where(Building.id == b_id)
    tariff_val = db.scalar(building_stmt) or 8.00

    # 4. Count active anomalies (status != 'normal' or status in ['warning', 'anomaly'])
    anomaly_count_stmt = select(func.count(Anomaly.id)).where(
        and_(
            Anomaly.building_id == b_id if building_id is not None else True,
            Anomaly.anomaly_status.in_(["warning", "anomaly"])
        )
    )
    active_anomalies = db.scalar(anomaly_count_stmt) or 0

    expected_usage: Optional[float] = None
    excess_energy: Optional[float] = None
    estimated_excess_cost: Optional[float] = None
    energy_efficiency: Optional[float] = None

    if expected_usage_val is not None:
        expected_usage = round(float(expected_usage_val), 2)
        excess_energy = round(max(0.0, current_usage - expected_usage), 2)
        estimated_excess_cost = round(excess_energy * float(tariff_val), 2)

        if current_usage > 0:
            # Efficiency percentage = (expected / actual) * 100 capped logically
            energy_efficiency = round((expected_usage / current_usage) * 100, 2)

    return DashboardSummary(
        currentUsage=round(current_usage, 2),
        expectedUsage=expected_usage,
        excessEnergy=excess_energy,
        estimatedExcessCost=estimated_excess_cost,
        activeAnomalies=active_anomalies,
        energyEfficiency=energy_efficiency
    )
