"""Framework-neutral integration surface between ML output and the dashboard.

Member 2/3 adapters should normalize a cleaned observation to the input
contract documented in API_CONTRACTS.md and call ``process_observation``.
Member 1 can consume the dashboard/detail/report methods or wrap them in its
existing HTTP framework. An optional callback publishes anomaly updates.
"""

from typing import Any, Callable, Optional

from analytics_engine import AnalyticsEngine
from cost_engine import CostInputError, calculate_excess_cost
from investigation_engine import build_investigation
from report_generator import generate_html_report, generate_json_report


class WattWiseAnalyticsService:
    def __init__(
        self,
        tariff_per_kwh: Any = None,
        building: Any = None,
        on_anomaly: Optional[Callable[[dict[str, Any]], None]] = None,
    ) -> None:
        self.tariff_per_kwh = tariff_per_kwh
        self.building = building
        self.on_anomaly = on_anomaly
        self.observations: list[dict[str, Any]] = []
        self.anomalies: list[dict[str, Any]] = []
        self._next_anomaly_number = 1
        self.analytics_engine = AnalyticsEngine()

    def process_observation(self, source: dict[str, Any]) -> dict[str, Any]:
        """Calculate costs, retain one observation, and publish new anomalies.

        Required source fields: ``timestamp`` (or ``startTime``),
        ``expectedKwh``, ``actualKwh``, and boolean ``isAnomaly``. The tariff
        can be supplied per observation or configured on the service.
        """
        record = dict(source)
        timestamp = record.get("timestamp") or record.get("startTime")
        if timestamp is None:
            return {"status": "missing_timestamp", "message": "Provide timestamp or startTime."}
        if "expectedKwh" not in record or record.get("expectedKwh") is None or "actualKwh" not in record or record.get("actualKwh") is None or not isinstance(record.get("isAnomaly"), bool):
            return {
                "status": "missing_ml_output",
                "message": "Expected/actual consumption and a boolean isAnomaly result are required.",
            }

        tariff = record.get("tariffPerKwh", self.tariff_per_kwh)
        try:
            cost = calculate_excess_cost(record["actualKwh"], record["expectedKwh"], tariff)
        except CostInputError as exc:
            return {"status": "invalid_input", "message": str(exc)}

        record.update({
            "timestamp": timestamp,
            "expectedKwh": cost.expected_kwh,
            "actualKwh": cost.actual_kwh,
            "tariffPerKwh": cost.tariff_per_kwh,
            "excessKwh": cost.excess_kwh,
            "estimatedExcessCost": cost.estimated_excess_cost,
            "isAnomaly": record["isAnomaly"],
        })

        detail = None
        if record["isAnomaly"]:
            anomaly_id = record.get("anomalyId")
            if not anomaly_id:
                anomaly_id = f"AN-{self._next_anomaly_number:03d}"
                self._next_anomaly_number += 1
            record["anomalyId"] = anomaly_id
            detail = build_investigation(record, tariff_per_kwh=tariff)
            # Keep the integration API's explicit ``estimatedCost`` field.
            detail["estimatedCost"] = cost.estimated_excess_cost
            self.anomalies.append(record)

        self.observations.append(record)
        result: dict[str, Any] = {"status": cost.status, "observation": dict(record)}
        if detail is not None:
            result["anomaly"] = detail
            if self.on_anomaly:
                event = {
                    "type": "anomaly.created",
                    "anomaly": detail,
                    "dashboard": self.get_dashboard_summary(),
                }
                try:
                    self.on_anomaly(event)
                    result["notificationStatus"] = "sent"
                except Exception as exc:  # state is committed; callers can retry notification
                    result["notificationStatus"] = "failed"
                    result["notificationError"] = str(exc)
        return result

    def process_batch(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [self.process_observation(record) for record in records]

    def get_dashboard_summary(self) -> dict[str, Any]:
        latest = self.observations[-1] if self.observations else None
        costs = [item.get("estimatedExcessCost") for item in self.anomalies]
        total_cost = None if any(value is None for value in costs) else round(sum(costs), 2)
        top = sorted(
            self.anomalies,
            key=lambda item: (item.get("estimatedExcessCost") is not None, item.get("estimatedExcessCost") or 0),
            reverse=True,
        )[:5]
        largest = max(self.anomalies, key=lambda item: item.get("excessKwh") or 0, default=None)
        return {
            "currentUsage": latest.get("actualKwh") if latest else None,
            "expectedUsage": latest.get("expectedKwh") if latest else None,
            "excessEnergy": latest.get("excessKwh") if latest else None,
            "estimatedExcessCost": total_cost,
            "activeAnomalies": len(self.anomalies),
            "largestAnomaly": {
                "anomalyId": largest.get("anomalyId"),
                "excessKwh": largest.get("excessKwh"),
                "estimatedExcessCost": largest.get("estimatedExcessCost"),
            } if largest else None,
            "topCostImpact": [
                {
                    "anomalyId": item.get("anomalyId"),
                    "excessKwh": item.get("excessKwh"),
                    "estimatedExcessCost": item.get("estimatedExcessCost"),
                }
                for item in top
            ],
            "costCoverageComplete": all(value is not None for value in costs),
        }

    def get_anomaly_detail(self, anomaly_id: str) -> Optional[dict[str, Any]]:
        anomaly = next((item for item in self.anomalies if item.get("anomalyId") == anomaly_id), None)
        return build_investigation(anomaly) if anomaly else None

    def get_analytics(self, custom_start: Any = None, custom_end: Any = None) -> dict[str, Any]:
        return self.analytics_engine.generate(
            self.observations,
            self.anomalies,
            custom_start=custom_start,
            custom_end=custom_end,
        )

    def get_reports(self, anomaly_id: str) -> Optional[dict[str, str]]:
        anomaly = next((item for item in self.anomalies if item.get("anomalyId") == anomaly_id), None)
        if anomaly is None:
            return None
        return {
            "json": generate_json_report(anomaly, building=self.building),
            "html": generate_html_report(anomaly, building=self.building),
            "printable": generate_html_report(anomaly, building=self.building),
        }
