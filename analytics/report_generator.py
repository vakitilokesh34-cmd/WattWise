"""JSON and printable HTML investigation report generation."""

import html
import json
from typing import Any

from investigation_engine import build_investigation


DISCLAIMER = (
    "This analysis identifies unusual consumption patterns. "
    "It does not establish the physical cause of the anomaly."
)


def build_report_data(anomaly: dict[str, Any], building: Any = None, tariff_per_kwh: Any = None) -> dict[str, Any]:
    investigation = build_investigation(anomaly, tariff_per_kwh=tariff_per_kwh)
    start, end = investigation.get("startTime"), investigation.get("endTime")
    period = investigation["sections"]["WHEN DID IT HAPPEN?"]
    if period == "Time period was not provided." and (start or end):
        period = f"{start or ''} – {end or ''}".strip(" –")
    return {
        "title": "WATTWISE ENERGY INVESTIGATION BRIEF",
        "building": building if building else "Not provided",
        "period": period,
        "expectedConsumptionKwh": investigation.get("expectedKwh"),
        "actualConsumptionKwh": investigation.get("actualKwh"),
        "excessKwh": investigation.get("excessKwh"),
        "estimatedExcessCost": investigation.get("estimatedCost"),
        "observation": investigation.get("observation"),
        "evidence": investigation.get("evidence", []),
        "possibleFactorsToInvestigate": investigation.get("possibleFactors", []),
        "recommendedChecks": investigation.get("recommendedChecks", []),
        "disclaimer": DISCLAIMER,
        "anomalyId": investigation.get("anomalyId"),
    }


def generate_json_report(anomaly: dict[str, Any], building: Any = None, tariff_per_kwh: Any = None) -> str:
    return json.dumps(build_report_data(anomaly, building, tariff_per_kwh), ensure_ascii=False, indent=2, allow_nan=False)


def generate_html_report(anomaly: dict[str, Any], building: Any = None, tariff_per_kwh: Any = None) -> str:
    data = build_report_data(anomaly, building, tariff_per_kwh)

    def safe(value: Any) -> str:
        if value is None:
            return "Unavailable"
        return html.escape(str(value))

    def list_items(values: list[Any]) -> str:
        if not values:
            return "<li>None available</li>"
        return "".join(f"<li>{safe(value)}</li>" for value in values)

    expected = data["expectedConsumptionKwh"]
    actual = data["actualConsumptionKwh"]
    excess = data["excessKwh"]
    cost = data["estimatedExcessCost"]
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{safe(data['title'])}</title><style>
body{{font:16px/1.5 Arial,sans-serif;color:#17212b;max-width:850px;margin:2rem auto;padding:0 1.5rem}}
h1{{font-size:1.6rem}}h2{{font-size:1.1rem;margin-top:1.5rem}}.facts{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}}
.fact{{padding:.7rem;background:#f1f5f8;border-radius:.35rem}}.disclaimer{{border-top:1px solid #bbb;margin-top:2rem;padding-top:1rem;color:#46515c}}
@media print{{body{{max-width:none;margin:0;padding:0}}button{{display:none}}}}
</style></head><body>
<h1>{safe(data['title'])}</h1>
<p><strong>Building:</strong> {safe(data['building'])}<br><strong>Period:</strong> {safe(data['period'])}</p>
<section class="facts"><div class="fact"><strong>Expected Consumption:</strong> {safe(expected)} kWh</div>
<div class="fact"><strong>Actual Consumption:</strong> {safe(actual)} kWh</div>
<div class="fact"><strong>Excess:</strong> {safe(excess)} kWh</div>
<div class="fact"><strong>Estimated Excess Cost:</strong> {('₹' + format(float(cost), ',.2f')) if cost is not None else 'Unavailable'}</div></section>
<h2>Observation</h2><p>{safe(data['observation'])}</p>
<h2>Evidence</h2><ul>{list_items(data['evidence'])}</ul>
<h2>Possible Factors to Investigate</h2><ul>{list_items(data['possibleFactorsToInvestigate'])}</ul>
<h2>Recommended Checks</h2><ul>{list_items(data['recommendedChecks'])}</ul>
<p class="disclaimer">{safe(data['disclaimer'])}</p>
<button type="button" onclick="window.print()">Print report</button>
</body></html>"""


def generate_printable_report(anomaly: dict[str, Any], building: Any = None, tariff_per_kwh: Any = None) -> str:
    """Return print-styled HTML; browsers can print it or save as PDF."""
    return generate_html_report(anomaly, building, tariff_per_kwh)
