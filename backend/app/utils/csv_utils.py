import io
import pandas as pd
from typing import List, Dict, Any, Tuple
from app.utils.validation import (
    WattWiseException,
    validate_energy_value,
    validate_occupancy_value,
    validate_temperature_value,
    validate_timestamp_value,
)


REQUIRED_COLUMNS = {"timestamp", "energy_kwh"}
OPTIONAL_COLUMNS = {"temperature", "occupancy", "building_id", "tariff"}


def parse_and_validate_csv(content: bytes, default_building_id: int = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses raw CSV byte content, validates header, validates and cleans each row.
    Returns: (valid_rows, invalid_row_errors)
    """
    if not content:
        raise WattWiseException("EMPTY_FILE", "CSV file is empty.")

    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise WattWiseException("INVALID_CSV", f"Failed to parse CSV content: {str(e)}")

    if df.empty:
        raise WattWiseException("EMPTY_CSV", "CSV file contains no data rows.")

    # Standardize column headers: trim spaces and convert to lowercase
    df.columns = [str(c).strip().lower() for c in df.columns]

    missing_cols = REQUIRED_COLUMNS - set(df.columns)
    if missing_cols:
        raise WattWiseException(
            "MISSING_REQUIRED_COLUMNS",
            f"CSV file is missing required column(s): {', '.join(sorted(missing_cols))}"
        )

    valid_rows = []
    rejected_rows = []

    # Process row by row
    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed header is row 1
        row_dict = row.to_dict()

        try:
            # Timestamp
            raw_ts = row_dict.get("timestamp")
            dt = validate_timestamp_value(raw_ts, row_num=row_num)

            # Energy
            raw_energy = row_dict.get("energy_kwh")
            energy_kwh = validate_energy_value(raw_energy, row_num=row_num)

            # Optional Temperature
            raw_temp = row_dict.get("temperature")
            temperature = validate_temperature_value(raw_temp, row_num=row_num)

            # Optional Occupancy
            raw_occ = row_dict.get("occupancy")
            occupancy = validate_occupancy_value(raw_occ, row_num=row_num)

            # Optional building_id in row
            raw_b_id = row_dict.get("building_id")
            building_id = default_building_id
            if raw_b_id and str(raw_b_id).strip() and str(raw_b_id).lower() != "nan":
                try:
                    building_id = int(float(raw_b_id))
                except ValueError:
                    raise WattWiseException("INVALID_BUILDING_ID", f"Row {row_num}: building_id must be an integer.")

            # Optional tariff in row
            raw_tariff = row_dict.get("tariff")
            tariff = None
            if raw_tariff and str(raw_tariff).strip() and str(raw_tariff).lower() != "nan":
                try:
                    tariff = float(raw_tariff)
                except ValueError:
                    raise WattWiseException("INVALID_TARIFF", f"Row {row_num}: tariff must be a valid number.")

            cleaned_row = {
                "row_num": row_num,
                "building_id": building_id,
                "timestamp": dt,
                "energy_kwh": energy_kwh,
                "temperature": temperature,
                "occupancy": occupancy,
                "tariff": tariff
            }
            valid_rows.append(cleaned_row)

        except WattWiseException as e:
            rejected_rows.append({
                "row_num": row_num,
                "code": e.code,
                "message": e.message
            })
        except Exception as e:
            rejected_rows.append({
                "row_num": row_num,
                "code": "UNEXPECTED_ROW_ERROR",
                "message": f"Row {row_num}: {str(e)}"
            })

    return valid_rows, rejected_rows
