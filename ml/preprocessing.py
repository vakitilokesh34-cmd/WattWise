import pandas as pd
import numpy as np
from pathlib import Path

from .config import RESAMPLE_FREQ

def parse_timestamp(df: pd.DataFrame, column: str = "timestamp") -> pd.DataFrame:
    """Parse the timestamp column to datetime, coercing errors to NaT.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame.
    column : str, default "timestamp"
        Name of the timestamp column.
    """
    df[column] = pd.to_datetime(df[column], errors="coerce")
    return df

def sort_data(df: pd.DataFrame, column: str = "timestamp") -> pd.DataFrame:
    """Sort DataFrame by timestamp and reset index."""
    df = df.sort_values(by=column).reset_index(drop=True)
    return df

def remove_duplicates(df: pd.DataFrame, column: str = "timestamp") -> pd.DataFrame:
    """Drop duplicate timestamps, keeping the first occurrence."""
    return df.drop_duplicates(subset=[column])

def handle_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    """Impute missing numeric values using forward fill then backward fill.
    Non‑numeric columns are left untouched.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].ffill().bfill()
    return df

def detect_invalid_values(df: pd.DataFrame) -> pd.DataFrame:
    """Detect obviously invalid values (negative energy, absurdly high values).
    Returns a DataFrame with a boolean column ``invalid`` marking rows.
    """
    # Energy cannot be negative; set a high ceiling (e.g., 10× median) as heuristic.
    median = df["energy_kwh"].median()
    high_limit = median * 10 if pd.notna(median) else np.inf
    df["invalid"] = (df["energy_kwh"] < 0) | (df["energy_kwh"] > high_limit)
    return df

def resample_data(df: pd.DataFrame, freq: str = RESAMPLE_FREQ) -> pd.DataFrame:
    """Resample to a regular frequency (default hourly).
    Aggregates by mean for numeric columns and takes the first for non‑numeric.
    """
    df = df.set_index("timestamp")
    agg_dict = {col: "mean" for col in df.select_dtypes(include=[np.number]).columns}
    # Preserve categorical columns by forward‑filling after resample.
    df_resampled = df.resample(freq).agg(agg_dict)
    # Forward‑fill non‑numeric metadata if present.
    df_resampled = df_resampled.ffill()
    df_resampled = df_resampled.reset_index()
    return df_resampled

def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Full preprocessing pipeline.

    Steps
    -----
    1. Parse timestamps
    2. Sort
    3. Remove duplicate timestamps
    4. Detect invalid values (adds ``invalid`` column)
    5. Remove rows flagged as invalid – they are likely sensor errors, not true anomalies.
    6. Impute missing numeric values
    7. Resample to regular frequency **only if no invalid rows were removed**
    """
    df = parse_timestamp(df)
    df = sort_data(df)
    df = remove_duplicates(df)
    df = detect_invalid_values(df)
    # Identify and drop invalid rows
    invalid_mask = df["invalid"]
    any_invalid = invalid_mask.any()
    df = df[~invalid_mask].drop(columns=["invalid"])
    df = handle_missing_values(df)
    # Resample only when data had no invalid rows removed
    if not any_invalid:
        df = resample_data(df)
    return df
