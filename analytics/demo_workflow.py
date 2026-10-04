"""Deterministic end-to-end Member 4 demo (Python standard library only)."""

import argparse
import json
from pathlib import Path
from typing import Any

from integration import WattWiseAnalyticsService


def run_demo(output_dir: Any = None) -> dict[str, Any]:
    notifications: list[dict[str, Any]] = []
    service = WattWiseAnalyticsService(
        tariff_per_kwh=8,
        building="Block A",
        on_anomaly=notifications.append,
    )

    # Member 3 output represents a consolidated 2-hour anomaly. The timeline
    # marks the observed progression without fabricating extra meter readings.
    result = service.process_observation({
        "anomalyId": "AN-024",
        "startTime": "2026-10-02T22:00:00",
        "endTime": "2026-10-03T00:00:00",
        "timestamp": "2026-10-02T22:00:00",
        "expectedKwh": 100,
        "actualKwh": 180,
        "isAnomaly": True,
        "building": "Block A",
    })
    if result.get("status") != "ready":
        raise RuntimeError(f"Demo observation was not processed: {result}")

    # A normal follow-up is represented as a status event: no measurement is
    # invented for the normalized period.
    timeline = [
        {"time": "22:00", "event": "anomaly starts"},
        {"time": "23:00", "event": "anomaly continues"},
        {"time": "00:00", "event": "consumption normalizes"},
    ]
    anomaly_id = result["anomaly"]["anomalyId"]
    reports = service.get_reports(anomaly_id)
    output = {
        "workflow": [
            "CSV / backend cleaned observation (represented by fixture)",
            "ML baseline and anomaly output (represented by fixture)",
            "excess energy and estimated cost",
            "evidence and investigation brief",
            "dashboard summary and frontend notification",
        ],
        "timeline": timeline,
        "dashboard": service.get_dashboard_summary(),
        "anomaly": service.get_anomaly_detail(anomaly_id),
        "analytics": service.get_analytics(),
        "investigationBrief": json.loads(reports["json"]) if reports else None,
        "notificationCount": len(notifications),
    }

    if output_dir is not None:
        directory = Path(output_dir)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "investigation-brief.json").write_text(json.dumps(output["investigationBrief"], ensure_ascii=False, indent=2), encoding="utf-8")
        (directory / "investigation-brief.html").write_text(reports["html"], encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", help="Optional directory for JSON and printable HTML reports")
    args = parser.parse_args()
    # ASCII escaping keeps the CLI usable under Windows cp1252 consoles while
    # the JSON and HTML report files remain UTF-8.
    print(json.dumps(run_demo(args.output_dir), ensure_ascii=True, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
