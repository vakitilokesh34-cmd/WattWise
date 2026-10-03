import pandas as pd
import numpy as np
from pathlib import Path

from .config import ROLLING_WINDOW, LAG_1, LAG_24


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add basic time‑based features.

    - hour (0‑23)
    - day_of_week (0=Monday)
    - day_of_month (1‑31)
    - month (1‑12)
    - is_weekend (bool)
    """
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["day_of_month"] = df["timestamp"].dt.day
    df["month"] = df["timestamp"].dt.month
    df["is_weekend"] = df["day_of_week"] >= 5
    return df


def add_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add rolling mean and std for the energy consumption.

    The rolling window is defined in hours (default 24). The function assumes the
    DataFrame is ordered by ``timestamp`` and has a regular frequency (e.g., hourly).
    """
    df = df.set_index("timestamp")
    df["rolling_mean"] = df["energy_kwh"].rolling(window=ROLLING_WINDOW, min_periods=1).mean()
    df["rolling_std"] = df["energy_kwh"].rolling(window=ROLLING_WINDOW, min_periods=1).std().fillna(0)
    df = df.reset_index()
    return df


def add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add lagged energy values.

    - ``lag_1``  : previous hour
    - ``lag_24`` : same hour previous day (24‑hour lag)
    """
    df = df.set_index("timestamp")
    df["lag_1"] = df["energy_kwh"].shift(LAG_1)
    df["lag_24"] = df["energy_kwh"].shift(LAG_24)
    df = df.reset_index()
    return df


def add_optional_features(df: pd.DataFrame) -> pd.DataFrame:
    """Pass‑through optional columns (temperature, occupancy) if present.
    The function does not create them – it only ensures they are retained.
    """
    # No transformation required; placeholder for future scaling.
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Run the full feature engineering pipeline.

    Returns a DataFrame ready for model training/prediction. Non‑numeric optional
    columns are left unchanged.
    """
    df = add_time_features(df)
    df = add_rolling_features(df)
    df = add_lag_features(df)
    df = add_optional_features(df)
    # After creating lag features, rows at the start will have NaNs – forward fill.
    df = df.ffill().bfill()
    return df
