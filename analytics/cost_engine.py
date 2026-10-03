"""Cost calculations for WattWise anomaly records.

This module reports estimated excess cost only. It does not claim a guaranteed
financial loss or savings.
"""

from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import math
from typing import Any, Optional


class CostInputError(ValueError):
    """Raised when a supplied energy or tariff value is invalid."""


def _number(value: Any, name: str) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, bool):
        raise CostInputError(f"{name} must be a finite, non-negative number")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise CostInputError(f"{name} must be a finite, non-negative number") from None
    if not number.is_finite() or number < 0:
        raise CostInputError(f"{name} must be a finite, non-negative number")
    return number


def _rounded(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class CostImpact:
    expected_kwh: Optional[float]
    actual_kwh: Optional[float]
    tariff_per_kwh: Optional[float]
    excess_kwh: Optional[float]
    estimated_excess_cost: Optional[float]
    status: str

    def to_dict(self) -> dict[str, Any]:
        """Return the public camelCase response shape."""
        return {
            "expectedKwh": self.expected_kwh,
            "actualKwh": self.actual_kwh,
            "tariffPerKwh": self.tariff_per_kwh,
            "excessKwh": self.excess_kwh,
            "estimatedExcessCost": self.estimated_excess_cost,
            "status": self.status,
        }


def calculate_excess_cost(
    actual_kwh: Any,
    expected_kwh: Any,
    tariff_per_kwh: Any,
) -> CostImpact:
    """Calculate excess kWh and its estimated cost.

    Missing expected/actual values indicate missing ML output. Missing tariff
    leaves the energy calculation available while cost remains unknown.
    """
    actual = _number(actual_kwh, "actual_kwh")
    expected = _number(expected_kwh, "expected_kwh")
    tariff = _number(tariff_per_kwh, "tariff_per_kwh")
    if actual is None or expected is None:
        return CostImpact(
            float(expected) if expected is not None else None,
            float(actual) if actual is not None else None,
            float(tariff) if tariff is not None else None,
            None,
            None,
            "missing_ml_output",
        )

    excess = max(actual - expected, Decimal(0))
    cost = _rounded(excess * tariff) if tariff is not None else None
    status = "ready" if tariff is not None else "missing_tariff"
    return CostImpact(
        float(expected),
        float(actual),
        float(tariff) if tariff is not None else None,
        _rounded(excess),
        cost,
        status,
    )


def calculate_estimated_excess_cost(actual_kwh: Any, expected_kwh: Any, tariff_per_kwh: Any) -> dict[str, Any]:
    """Dictionary-returning convenience API for integrations."""
    return calculate_excess_cost(actual_kwh, expected_kwh, tariff_per_kwh).to_dict()
