import pandas as pd
import numpy as np
from pathlib import Path

from .config import BASELINE_MODEL_PATH, ANOMALY_MODEL_PATH
from .preprocessing import preprocess
from .features import engineer_features
from .baseline import train_baseline, save_baseline, load_baseline, predict_baseline
from .anomaly import train_anomaly_detector, save_anomaly_model, load_anomaly_model, detect_anomalies


def train_pipeline(df: pd.DataFrame) -> None:
    """Full training pipeline.

    1. Preprocess raw data.
    2. Engineer features.
    3. Train baseline model (hourly‑weekly average).
    4. Train isolation‑forest anomaly detector on residuals.
    5. Persist both models to disk.
    """
    # Step 1 & 2
    df_clean = preprocess(df)
    df_feat = engineer_features(df_clean)

    # Baseline
    baseline_model = train_baseline(df_feat)
    save_baseline(baseline_model, BASELINE_MODEL_PATH)

    # Compute expected for training anomaly detector
    df_feat["expected_kwh"] = predict_baseline(df_feat, baseline_model)
    # Train anomaly detector on residuals
    anomaly_model = train_anomaly_detector(df_feat)
    save_anomaly_model(anomaly_model, ANOMALY_MODEL_PATH)


def load_models():
    """Load persisted baseline and anomaly models.

    Returns
    -------
    tuple(dict, IsolationForest)
        baseline model dict and anomaly IsolationForest model.
    """
    baseline = load_baseline(BASELINE_MODEL_PATH)
    anomaly = load_anomaly_model(ANOMALY_MODEL_PATH)
    return baseline, anomaly


def predict(df: pd.DataFrame) -> pd.DataFrame:
    """Run inference on a raw dataframe.

    Returns a dataframe containing the original columns plus all engineered
    features, baseline prediction, residuals and anomaly scores.
    """
    df_clean = preprocess(df)
    df_feat = engineer_features(df_clean)
    baseline, anomaly = load_models()
    # Detect anomalies (adds expected_kwh, residual, scores, etc.)
    result = detect_anomalies(df_feat, baseline, anomaly)
    return result


def get_anomaly_periods(df: pd.DataFrame) -> pd.DataFrame:
    """Group consecutive anomalous rows into periods.

    Returns a summary dataframe with columns:
    - start_time
    - end_time
    - peak_deviation (max absolute deviation)
    - total_excess_energy (sum of excess_kwh)
    - average_anomaly_score
    """
    df = df.copy()
    # Ensure anomaly flag column exists
    if "is_anomaly" not in df.columns:
        raise ValueError("Dataframe must contain 'is_anomaly' column.")
    # Identify groups of consecutive anomalies
    df["anomaly_group"] = (
        (df["is_anomaly"] != df["is_anomaly"].shift()).cumsum()
    )
    # Filter only anomaly groups
    anomaly_groups = df[df["is_anomaly"]].groupby("anomaly_group")
    periods = []
    for _, group in anomaly_groups:
        start_time = group["timestamp"].iloc[0]
        end_time = group["timestamp"].iloc[-1]
        peak_deviation = group["absolute_deviation"].max()
        total_excess = group["residual"].sum()
        avg_score = group["anomaly_score"].mean()
        periods.append(
            {
                "start_time": start_time,
                "end_time": end_time,
                "peak_deviation": peak_deviation,
                "total_excess_energy": total_excess,
                "average_anomaly_score": avg_score,
            }
        )
    return pd.DataFrame(periods)


def infer(df: pd.DataFrame):
    """Convenient end‑to‑end inference returning three dataframes.

    Returns
    -------
    tuple(pd.DataFrame, pd.DataFrame, pd.DataFrame)
        baseline_df, anomaly_df, periods_df
    """
    result = predict(df)
    # Baseline dataframe (timestamp, actual, expected)
    baseline_df = result[["timestamp", "energy_kwh", "expected_kwh"]].rename(
        columns={"energy_kwh": "actual_kwh"}
    )
    # Anomaly dataframe with full details
    anomaly_df = result.copy()
    # Periods summary
    periods_df = get_anomaly_periods(result)
    return baseline_df, anomaly_df, periods_df
