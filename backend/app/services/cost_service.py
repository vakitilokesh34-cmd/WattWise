import logging
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.anomaly import Anomaly
from app.models.building import Building
from app.schemas.cost import CostImpactResponse, CostImpactBreakdownItem
from app.utils.datetime_utils import format_iso, utc_now

logger = logging.getLogger("wattwise.cost_service")


def get_cost_impact(
    db: Session,
    building_id: Optional[int] = None,
    period: str = "weekly",
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> CostImpactResponse:
    # Determine date window based on period
    now = utc_now()
    period_clean = (period or "weekly").lower()

    calc_start: Optional[datetime] = start_date
    calc_end: Optional[datetime] = end_date

    if period_clean == "daily":
        calc_start = now - timedelta(days=1)
        calc_end = now
    elif period_clean == "weekly":
        calc_start = now - timedelta(days=7)
        calc_end = now
    elif period_clean == "monthly":
        calc_start = now - timedelta(days=30)
        calc_end = now
    elif period_clean == "custom":
        if not calc_start:
            calc_start = now - timedelta(days=7)
        if not calc_end:
            calc_end = now

    # Fetch building tariff
    tariff = 8.00
    if building_id is not None:
        building = db.scalar(select(Building).where(Building.id == building_id))
        if building:
            tariff = building.tariff

    # Query anomalies
    stmt = select(Anomaly)
    conditions = []
    if building_id is not None:
        conditions.append(Anomaly.building_id == building_id)
    if calc_start is not None:
        conditions.append(Anomaly.timestamp >= calc_start)
    if calc_end is not None:
        conditions.append(Anomaly.timestamp <= calc_end)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(Anomaly.timestamp.asc())
    anomalies = db.scalars(stmt).all()

    total_actual = 0.0
    total_expected = 0.0
    total_excess = 0.0
    total_cost_impact = 0.0

    breakdown: List[CostImpactBreakdownItem] = []

    for anom in anomalies:
        actual = float(anom.actual_energy_kwh)
        expected = float(anom.expected_energy_kwh)
        excess = float(anom.excess_kwh)
        cost = excess * tariff

        total_actual += actual
        total_expected += expected
        total_excess += excess
        total_cost_impact += cost

        breakdown.append(
            CostImpactBreakdownItem(
                timestamp=format_iso(anom.timestamp),
                actualEnergyKwh=round(actual, 2),
                expectedEnergyKwh=round(expected, 2),
                excessKwh=round(excess, 2),
                tariff=tariff,
                costImpact=round(cost, 2)
            )
        )

    return CostImpactResponse(
        building_id=building_id,
        period=period_clean,
        start_date=format_iso(calc_start) if calc_start else None,
        end_date=format_iso(calc_end) if calc_end else None,
        actual_energy_kwh=round(total_actual, 2),
        expected_energy_kwh=round(total_expected, 2),
        excess_kwh=round(total_excess, 2),
        tariff=tariff,
        total_cost_impact=round(total_cost_impact, 2),
        breakdown=breakdown
    )
