# WattWise analytics and investigation layer

## Scope

This Member 4 layer consumes cleaned energy observations and expected/actual ML output. It calculates excess energy and estimated excess cost, prepares chart series and dashboard summaries, creates evidence-based investigation details, and generates JSON and printable HTML reports. It does not implement ingestion, cleaning, a baseline model, anomaly detection, database persistence, or dashboard components. See [API_CONTRACTS.md](API_CONTRACTS.md) for the adapter schema and suggested mappings.

## Local deterministic demo

Requires Python 3.10+ and the standard library only.

```powershell
cd analytics
python demo_workflow.py
python demo_workflow.py --output-dir generated_reports
```

The demo fixture uses expected 100 kWh, actual 180 kWh, and ₹8/kWh across 22:00–00:00. It produces 80 excess kWh and **Estimated Excess Cost** ₹640, a dashboard summary, anomaly detail, investigation brief, and one frontend callback notification. Its timeline describes 22:00 start, 23:00 continuation, and 00:00 normalization; it does not invent additional meter readings. The optional output directory receives a JSON and printable HTML report.

## Connect the existing system

1. Have Member 2 pass its cleaned period timestamp and consumption values to the existing ML integration.
2. Have Member 3 return the expected and actual kWh and explicit boolean anomaly flag from its current model.
3. Configure the tariff and building once, then call `WattWiseAnalyticsService.process_observation()` for each accepted ML result. Records missing model output are returned with an explanatory status and are not added to analytics.
4. Expose the service's dashboard, analytics, detail, and report methods through the existing backend routes. Pass `on_anomaly` to a small adapter that publishes the update on the frontend's existing event channel.
5. Member 1 can render the resulting chart data and summary/detail fields without recalculating cost in the browser.

The service is in-memory and intended as an integration layer. The host backend should persist its accepted records and restore service state or rehydrate the service after restart.

## Validation

Run the focused standard-library suite from the project root:

```powershell
cd analytics
python -m unittest discover -s tests -v
```

The tests cover normal use, one anomaly, multi-hour duration, multiple anomalies, zero excess, multiple tariffs, missing model output, missing tariff, no anomalies, report safety, chart aggregation, callback delivery, and consistency of the demo's 100/180/80/₹640 values.

## Integration check against real members

Once backend/ML/frontend modules are in this repository, map one known observation through their real CSV ingest and model result into `process_observation`. Compare the same normalized record against dashboard, anomaly detail, cost chart, and JSON/HTML brief. For the fixture, expected 100, actual 180, excess 80, tariff 8, and estimated excess cost 640 must match. Confirm a normal period has zero excess, missing tariff remains visibly unknown, and the frontend receives the callback event. No end-to-end check against those components can run in this workspace because those modules are not present.
