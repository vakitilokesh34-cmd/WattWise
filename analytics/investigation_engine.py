"""Evidence-grounded anomaly investigation generation."""

from datetime import datetime
from typing import Any, Optional

from cost_engine import calculate_excess_cost
from analytics_engine import parse_timestamp


POSSIBLE_FACTORS = (
    "HVAC schedules",
    "Lighting schedules",
    "Equipment operating hours",
    "Extended building operation",
    "Unexpected occupancy",
    "Meter/data quality",
)

RECOMMENDED_CHECKS = (
    "Compare HVAC schedules and operating logs with the anomaly period.",
    "Review lighting schedules and control logs for the anomaly period.",
    "Check equipment operating hours against the expected schedule.",
    "Confirm whether building operating hours changed during this period.",
    "Compare occupancy records, if available, with the anomaly period.",
    "Review meter readings and data completeness for this period.",
)


def _pretty_time(value: Any) -> Optional[str]:
    moment = parse_timestamp(value)
    if moment is None:
        return None
    return moment.strftime("%I:%M %p").lstrip("0")


def _period_label(start: Any, end: Any) -> Optional[str]:
    first = _pretty_time(start)
    last = _pretty_time(end)
    if first and last:
        return f"{first} – {last}"
    if first:
        return first
    return None


def _duration_text(start: Any, end: Any) -> Optional[str]:
    first, last = parse_timestamp(start), parse_timestamp(end)
    if first is None or last is None or last < first:
        return None
    hours = (last - first).total_seconds() / 3600
    if hours == 0:
        return None
    if hours >= 1:
        amount = round(hours, 1)
        unit = "hour" if amount == 1 else "hours"
    else:
        amount = round(hours * 60)
        unit = "minute" if amount == 1 else "minutes"
    return f"approximately {amount:g} {unit}"


def build_investigation(anomaly: dict[str, Any], tariff_per_kwh: Any = None) -> dict[str, Any]:
    """Create a structured, cautious investigation from supplied measurements."""
    record = dict(anomaly)
    expected = record.get("expectedKwh", record.get("expected_kwh"))
    actual = record.get("actualKwh", record.get("actual_kwh"))
    tariff = record.get("tariffPerKwh", record.get("tariff_per_kwh", tariff_per_kwh))
    cost = calculate_excess_cost(actual, expected, tariff)
    start = record.get("startTime", record.get("timestamp"))
    end = record.get("endTime")
    excess = record.get("excessKwh", record.get("excess_kwh", cost.excess_kwh))
    estimated_cost = record.get("estimatedExcessCost", record.get("estimatedCost", cost.estimated_excess_cost))
    label = _period_label(start, end)
    evidence: list[str] = []

    if actual is not None and expected is not None and excess is not None:
        try:
            if float(excess) > 0:
                evidence.append(f"Actual consumption exceeded expected consumption by {float(excess):g} kWh.")
            else:
                evidence.append("Actual consumption did not exceed the expected baseline in the supplied measurements.")
        except (TypeError, ValueError):
            pass
    duration = _duration_text(start, end)
    if duration:
        evidence.append(f"The anomaly lasted {duration}.")
    if label:
        first, last = _pretty_time(start), _pretty_time(end)
        evidence.append(
            f"The deviation occurred between {first} and {last}." if last
            else f"The deviation was observed at {first}."
        )

    historical = record.get("historicalTypicalKwh")
    if historical is not None and expected is not None:
        evidence.append(
            f"Historical consumption during similar periods is {float(historical):g} kWh, "
            f"compared with an expected {float(expected):g} kWh."
        )
    if estimated_cost is not None:
        evidence.append(f"Estimated Excess Cost is ₹{float(estimated_cost):,.2f}.")
    for item in record.get("evidence", []) or []:
        text = str(item).strip()
        if text and text not in evidence:
            evidence.append(text)

    if actual is not None and expected is not None:
        try:
            happened = "Consumption exceeded the learned expected baseline." if float(actual) > float(expected) else "The supplied measurements do not show consumption above the expected baseline."
        except (TypeError, ValueError):
            happened = "An anomaly was supplied; the consumption comparison could not be calculated."
    else:
        happened = "An anomaly was supplied, but expected or actual consumption is unavailable."

    detail = {
        "anomalyId": record.get("anomalyId"),
        "startTime": start,
        "endTime": end,
        "expectedKwh": expected,
        "actualKwh": actual,
        "excessKwh": excess,
        "estimatedCost": estimated_cost,
        "evidence": evidence,
        "possibleFactors": [f"Possible factor to investigate: {item}." for item in POSSIBLE_FACTORS],
        "recommendedChecks": list(RECOMMENDED_CHECKS),
        "observation": happened,
        "sections": {
            "WHAT HAPPENED?": happened,
            "WHEN DID IT HAPPEN?": label or "Time period was not provided.",
            "HOW MUCH ENERGY WAS EXCESS?": f"{float(excess):g} kWh" if excess is not None else "Unavailable from supplied data.",
            "WHAT IS THE ESTIMATED COST?": f"₹{float(estimated_cost):,.2f}" if estimated_cost is not None else "Unavailable because a tariff or required measurement is missing.",
            "WHAT EVIDENCE EXISTS?": evidence,
            "WHAT SHOULD BE INVESTIGATED?": [f"Possible factor to investigate: {item}." for item in POSSIBLE_FACTORS],
        },
    }
    return detail
