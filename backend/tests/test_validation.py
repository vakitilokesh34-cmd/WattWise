import pytest
from app.utils.validation import (
    WattWiseException,
    validate_energy_value,
    validate_occupancy_value,
    validate_temperature_value,
    validate_timestamp_value,
)
from app.utils.datetime_utils import parse_datetime, format_iso


def test_validate_energy_value():
    assert validate_energy_value("100.5") == 100.5
    assert validate_energy_value(0.0) == 0.0

    with pytest.raises(WattWiseException) as exc_info:
        validate_energy_value("-10.0")
    assert exc_info.value.code == "INVALID_ENERGY_NEGATIVE"

    with pytest.raises(WattWiseException) as exc_info:
        validate_energy_value("abc")
    assert exc_info.value.code == "INVALID_ENERGY_NUMERIC"


def test_validate_occupancy_value():
    assert validate_occupancy_value("45") == 45
    assert validate_occupancy_value(None) is None

    with pytest.raises(WattWiseException) as exc_info:
        validate_occupancy_value("-5")
    assert exc_info.value.code == "INVALID_OCCUPANCY_NEGATIVE"


def test_parse_datetime():
    dt = parse_datetime("2026-10-01T10:00:00Z")
    assert dt.year == 2026
    assert dt.month == 10
    assert dt.day == 1
    assert dt.hour == 10
    assert dt.tzinfo is not None

    iso_str = format_iso(dt)
    assert iso_str == "2026-10-01T10:00:00Z"
