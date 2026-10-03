# WattWise Member 4 integration contracts

The repository did not contain Member 2's backend or Member 1's HTTP/UI code. The service in `integration.py` is therefore a framework-neutral adapter; wrap these methods in the project's existing API framework when those components are available. Member 3 should send the normalized result below after its existing model runs.

## Input: backend / ML observation

Call `WattWiseAnalyticsService.process_observation(record)` with:

```json
{
  "anomalyId": "AN-024",
  "timestamp": "2026-10-02T22:00:00",
  "startTime": "2026-10-02T22:00:00",
  "endTime": "2026-10-03T00:00:00",
  "expectedKwh": 100,
  "actualKwh": 180,
  "isAnomaly": true,
  "tariffPerKwh": 8,
  "building": "Block A"
}
```

`timestamp` or `startTime`, expected and actual kWh, and a boolean `isAnomaly` are required. Tariff may be set per record or once when constructing the service. A missing expected/actual value or anomaly flag returns `missing_ml_output`; a missing tariff keeps excess kWh available and returns `missing_tariff` with cost `null`. Invalid negative/non-finite inputs return `invalid_input`. Values are non-negative finite numbers; costs are rounded to two decimal places.

## Service methods and response shapes

- `process_observation(record)` -> `{status, observation, anomaly?, notificationStatus?}`. Anomaly IDs are generated as `AN-001`, etc. if the ML output did not supply one.
- `get_dashboard_summary()` -> `currentUsage`, `expectedUsage`, `excessEnergy`, `estimatedExcessCost`, `activeAnomalies`, `largestAnomaly`, `topCostImpact`, and `costCoverageComplete`. The usage fields refer to the latest accepted observation; total estimated cost and anomaly count cover accepted anomalies in this service instance. `estimatedExcessCost` is `null` when any anomaly has no tariff.
- `get_anomaly_detail(anomaly_id)` -> investigation detail or `null`:

```json
{
  "anomalyId": "AN-024",
  "startTime": "2026-10-02T22:00:00",
  "endTime": "2026-10-03T00:00:00",
  "expectedKwh": 100,
  "actualKwh": 180,
  "excessKwh": 80,
  "estimatedCost": 640,
  "evidence": [],
  "possibleFactors": ["Possible factor to investigate: HVAC schedules."],
  "recommendedChecks": []
}
```

- `get_analytics(custom_start=None, custom_end=None)` -> `{summary, charts}`. Includes daily, Monday-start weekly, monthly and inclusive custom-range rollups, plus expected-vs-actual, excess, cost, anomaly frequency, daily/weekly/monthly trends and top anomaly periods. Chart points are based on accepted observations; cost totals are `null` for a group if any included observation has unknown cost.
- `get_reports(anomaly_id)` -> `{json, html, printable}` or `null`. Printable is HTML with print styles and a browser print button; use the browser's print-to-PDF option for PDF output.

## Suggested HTTP mapping

These are integration mappings, not HTTP routes implemented in this empty starter workspace:

| Method | Suggested route | Service operation |
| --- | --- | --- |
| `POST` | `/api/analytics/observations` | `process_observation(body)` |
| `GET` | `/api/analytics/dashboard` | `get_dashboard_summary()` |
| `GET` | `/api/analytics/summary?start=&end=` | `get_analytics(start, end)` |
| `GET` | `/api/anomalies/{anomalyId}` | `get_anomaly_detail(anomalyId)` |
| `GET` | `/api/anomalies/{anomalyId}/report.json` | JSON member of `get_reports` |
| `GET` | `/api/anomalies/{anomalyId}/report.html` | HTML/printable member of `get_reports` |

To notify a UI over its existing event transport, supply `on_anomaly(event)` when constructing the service. Each accepted anomaly emits `{type: "anomaly.created", anomaly, dashboard}` after state is updated. The callback can forward this event to the frontend's existing websocket, SSE, or event bus.

## Data and language rules

All cost labels use **Estimated Excess Cost**. `estimatedCost` in the anomaly detail is the short API field requested by the brief; reports and dashboard use `estimatedExcessCost`. Unknown values remain `null`. Historical-comparison evidence appears only when `historicalTypicalKwh` is supplied. Investigation factors are hypotheses and are phrased as “Possible factor to investigate.” The report disclaimer says that pattern detection does not establish physical cause.
