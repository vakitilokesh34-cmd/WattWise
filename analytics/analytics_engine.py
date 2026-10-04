"""Period rollups and chart-ready data for WattWise observations."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable, Optional


def parse_timestamp(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _period_key(moment: datetime, period: str) -> str:
    if period == "daily":
        return moment.date().isoformat()
    if period == "weekly":
        monday = moment.date() - timedelta(days=moment.weekday())
        return monday.isoformat()
    if period == "monthly":
        return moment.strftime("%Y-%m")
    raise ValueError(f"Unsupported period: {period}")


def _safe_num(value: Any) -> Optional[float]:
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result >= 0 and result < float("inf") else None


def _in_custom_range(moment: datetime, start: Any, end: Any) -> bool:
    start_dt = parse_timestamp(start)
    end_dt = parse_timestamp(end)
    # A date-only boundary includes the whole local calendar day.
    start_is_day = isinstance(start, date) and not isinstance(start, datetime) or isinstance(start, str) and len(start.strip()) == 10
    end_is_day = isinstance(end, date) and not isinstance(end, datetime) or isinstance(end, str) and len(end.strip()) == 10
    if start_dt:
        if start_is_day:
            if moment.date() < start_dt.date():
                return False
        else:
            left, right = moment, start_dt
            if (left.tzinfo is None) != (right.tzinfo is None):
                left, right = left.replace(tzinfo=None), right.replace(tzinfo=None)
            if left < right:
                return False
    if end_dt:
        if end_is_day:
            if moment.date() > end_dt.date():
                return False
        else:
            left, right = moment, end_dt
            if (left.tzinfo is None) != (right.tzinfo is None):
                left, right = left.replace(tzinfo=None), right.replace(tzinfo=None)
            if left > right:
                return False
    return True


def _money_total(rows: list[dict[str, Any]]) -> Optional[float]:
    values = [row.get("estimatedExcessCost") for row in rows]
    if not rows or any(value is None for value in values):
        return None if rows else 0.0
    return round(sum(float(value) for value in values), 2)


def _rollup(rows: list[dict[str, Any]], period: str) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        moment = parse_timestamp(row.get("timestamp") or row.get("startTime"))
        if moment is not None:
            groups[_period_key(moment, period)].append(row)
    result: list[dict[str, Any]] = []
    for key in sorted(groups):
        group = groups[key]
        result.append({
            "period": key,
            "expectedKwh": round(sum(row.get("expectedKwh", 0) or 0 for row in group), 2),
            "actualKwh": round(sum(row.get("actualKwh", 0) or 0 for row in group), 2),
            "excessKwh": round(sum(row.get("excessKwh", 0) or 0 for row in group), 2),
            "estimatedExcessCost": _money_total(group),
            "anomalyCount": sum(1 for row in group if row.get("isAnomaly")),
            "observationCount": len(group),
        })
    return result


class AnalyticsEngine:
    """Builds complete-period summaries and frontend chart series."""

    def generate(
        self,
        observations: Iterable[dict[str, Any]],
        anomalies: Optional[Iterable[dict[str, Any]]] = None,
        custom_start: Any = None,
        custom_end: Any = None,
    ) -> dict[str, Any]:
        rows = [dict(item) for item in observations]
        anomaly_rows = [dict(item) for item in anomalies] if anomalies is not None else [
            row for row in rows if row.get("isAnomaly")
        ]
        if custom_start is not None or custom_end is not None:
            rows = [
                row for row in rows
                if (moment := parse_timestamp(row.get("timestamp") or row.get("startTime"))) is not None
                and _in_custom_range(moment, custom_start, custom_end)
            ]
            anomaly_rows = [
                row for row in anomaly_rows
                if (moment := parse_timestamp(row.get("timestamp") or row.get("startTime"))) is not None
                and _in_custom_range(moment, custom_start, custom_end)
            ]

        daily = _rollup(rows, "daily")
        weekly = _rollup(rows, "weekly")
        monthly = _rollup(rows, "monthly")
        excess_values = [_safe_num(row.get("excessKwh")) or 0.0 for row in anomaly_rows]
        cost_known = [row for row in anomaly_rows if _safe_num(row.get("estimatedExcessCost")) is not None]
        largest_cost = max(cost_known, key=lambda row: _safe_num(row.get("estimatedExcessCost")) or 0.0, default=None)

        def deviation(row: dict[str, Any]) -> tuple[float, float]:
            excess = _safe_num(row.get("excessKwh")) or 0.0
            expected = _safe_num(row.get("expectedKwh")) or 0.0
            percent = (excess / expected * 100) if expected > 0 else (float("inf") if excess > 0 else 0.0)
            return percent, excess

        highest = max(anomaly_rows, key=deviation, default=None)
        if highest:
            high_expected = _safe_num(highest.get("expectedKwh")) or 0.0
            high_excess = _safe_num(highest.get("excessKwh")) or 0.0
            high_pct = round(high_excess / high_expected * 100, 2) if high_expected > 0 else None
            highest_period = {
                "anomalyId": highest.get("anomalyId"),
                "startTime": highest.get("startTime") or highest.get("timestamp"),
                "endTime": highest.get("endTime"),
                "expectedKwh": highest.get("expectedKwh"),
                "actualKwh": highest.get("actualKwh"),
                "excessKwh": highest.get("excessKwh"),
                "deviationPercent": high_pct,
            }
        else:
            highest_period = None

        return {
            "summary": {
                "dailyExcessCost": daily,
                "weeklyExcessCost": weekly,
                "monthlyExcessCost": monthly,
                "customPeriod": {
                    "startTime": custom_start,
                    "endTime": custom_end,
                    "totalExcessCost": _money_total(rows),
                    "totalExcessEnergyKwh": round(sum(_safe_num(row.get("excessKwh")) or 0 for row in rows), 2),
                    "anomalyCount": sum(1 for row in rows if row.get("isAnomaly")),
                },
                "totalExcessEnergyKwh": round(sum(excess_values), 2),
                "averageExcessPerAnomalyKwh": round(sum(excess_values) / len(excess_values), 2) if excess_values else 0.0,
                "largestCostImpactAnomaly": {
                    "anomalyId": largest_cost.get("anomalyId"),
                    "estimatedExcessCost": largest_cost.get("estimatedExcessCost"),
                    "excessKwh": largest_cost.get("excessKwh"),
                } if largest_cost else None,
                "highestDeviationPeriod": highest_period,
                "costCoverageComplete": all(row.get("estimatedExcessCost") is not None for row in rows),
            },
            "charts": {
                "expectedVsActual": [
                    {"timestamp": row.get("timestamp"), "expectedKwh": row.get("expectedKwh"), "actualKwh": row.get("actualKwh")}
                    for row in rows
                ],
                "excessEnergy": [
                    {"timestamp": row.get("timestamp"), "excessKwh": row.get("excessKwh", 0)} for row in rows
                ],
                "costImpact": [
                    {"timestamp": row.get("timestamp"), "estimatedExcessCost": row.get("estimatedExcessCost")}
                    for row in rows
                ],
                "anomalyFrequency": daily,
                "dailyTrends": daily,
                "weeklyTrends": weekly,
                "monthlyTrends": monthly,
                "topAnomalyPeriods": sorted(
                    anomaly_rows,
                    key=lambda row: (
                        _safe_num(row.get("estimatedExcessCost")) is not None,
                        _safe_num(row.get("estimatedExcessCost")) or 0.0,
                        _safe_num(row.get("excessKwh")) or 0.0,
                    ),
                    reverse=True,
                )[:10],
            },
        }
