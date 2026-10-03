import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from .config import BASELINE_MODEL_PATH


def train_baseline(df: pd.DataFrame) -> dict:
    """Train a simple time‑based baseline.

    The baseline predicts expected energy consumption by averaging historical
    values for each combination of ``hour`` and ``day_of_week``. This captures
    daily and weekly patterns while staying fully interpretable.

    Parameters
    ----------
    df : pd.DataFrame
        Pre‑processed DataFrame containing at least ``timestamp`` and
        ``energy_kwh`` columns.

    Returns
    -------
    dict
        Mapping ``(day_of_week, hour)`` → mean energy consumption.
    """
    # Ensure timestamp is datetime and set as index for convenience.
    df = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek

    # Group by weekly hour and compute mean.
    baseline = (
        df.groupby(["day_of_week", "hour"])['energy_kwh']
        .mean()
        .reset_index()
        .rename(columns={"energy_kwh": "expected_kwh"})
    )
    # Convert to dictionary for fast lookup during inference.
    baseline_dict = {
        (int(row["day_of_week"]), int(row["hour"])): float(row["expected_kwh"])
        for _, row in baseline.iterrows()
    }
    return baseline_dict


def save_baseline(model: dict, path: Path = BASELINE_MODEL_PATH) -> None:
    """Persist the baseline dictionary using ``joblib``."""
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)


def load_baseline(path: Path = BASELINE_MODEL_PATH) -> dict:
    """Load a persisted baseline model.

    Returns an empty dict if the model file does not exist.
    """
    if not path.is_file():
        return {}
    return joblib.load(path)


def predict_baseline(df: pd.DataFrame, model: dict) -> pd.Series:
    """Predict expected consumption for each row in ``df`` using the baseline.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing ``timestamp`` column.
    model : dict
        Baseline dictionary returned by :func:`train_baseline`.

    Returns
    -------
    pd.Series
        Expected energy values aligned with ``df`` index.
    """
    df = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    # Lookup expected value; fall back to overall median if missing.
    median_fallback = np.median(list(model.values())) if model else np.nan
    expected = []
    for _, row in df.iterrows():
        key = (int(row["day_of_week"]), int(row["hour"]))
        expected.append(model.get(key, median_fallback))
    return pd.Series(expected, index=df.index, name="expected_kwh")
