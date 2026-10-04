import sys
import os
import pandas as pd
import numpy as np
import pytest

# Ensure the project root is on PYTHONPATH
sys.path.append(r"e:/wattwise")

from ml.preprocessing import preprocess
from ml.features import engineer_features
from ml.baseline import train_baseline, predict_baseline
from ml.anomaly import detect_anomalies
from ml.inference import get_anomaly_periods

def generate_hourly_data(start, periods, value_func):
    """Generate a DataFrame with hourly timestamps and energy values.
    value_func receives the timestamp and returns the energy_kwh.
    """
    rng = pd.date_range(start=start, periods=periods, freq="H")
    data = {
        "timestamp": rng,
        "energy_kwh": [value_func(ts) for ts in rng],
    }
    return pd.DataFrame(data)

@pytest.fixture(scope="module")
def baseline_model():
    # Train a baseline on a week of normal consumption (100 kWh)
    df = generate_hourly_data("2023-01-01", 24 * 7, lambda ts: 100)
    df_clean = preprocess(df)
    df_feat = engineer_features(df_clean)
    model = train_baseline(df_feat)
    return model

def test_normal_consumption(baseline_model):
    df = generate_hourly_data("2023-01-08", 24, lambda ts: 100)
    df_clean = preprocess(df)
    df_feat = engineer_features(df_clean)
    result = detect_anomalies(df_feat, baseline_model, type('Dummy', (), {'decision_function': lambda self, X: np.zeros(len(X))})())
    assert not result["is_anomaly"].any()
    # Expected baseline should be close to 100
    assert np.allclose(result["expected_kwh"], 100, atol=1e-3)

def test_single_spike_anomaly(baseline_model):
    def value(ts):
        return 200 if ts.hour == 12 else 100
    df = generate_hourly_data("2023-01-08", 24, value)
    df_clean = preprocess(df)
    df_feat = engineer_features(df_clean)
    result = detect_anomalies(df_feat, baseline_model, type('Dummy', (), {'decision_function': lambda self, X: np.where(X < 0, -1, 0)})())
    # The spike should be flagged
    spike_row = result[result["timestamp"].dt.hour == 12].iloc[0]
    assert spike_row["is_anomaly"]
    # Verify residual is positive
    assert spike_row["residual"] > 0

def test_multi_hour_anomaly_period(baseline_model):
    def value(ts):
        return 180 if 22 <= ts.hour <= 23 else 100
    df = generate_hourly_data("2023-01-08", 24, value)
    df_clean = preprocess(df)
    df_feat = engineer_features(df_clean)
    result = detect_anomalies(df_feat, baseline_model, type('Dummy', (), {'decision_function': lambda self, X: np.where(X < -0.5, -1, 0)})())
    periods = get_anomaly_periods(result)
    # Expect a single period covering 22:00‑23:00
    assert len(periods) == 1
    period = periods.iloc[0]
    assert period["start_time"].hour == 22
    assert period["end_time"].hour == 23
    # Peak deviation should be > 0
    assert period["peak_deviation"] > 0

def test_missing_data_handling(baseline_model):
    df = generate_hourly_data("2023-01-08", 24, lambda ts: 100)
    # Drop a few rows to simulate missing data
    df = df.drop(index=[5, 6, 7])
    df_clean = preprocess(df)
    # After preprocessing missing values should be forward‑filled
    assert not df_clean["energy_kwh"].isna().any()
    df_feat = engineer_features(df_clean)
    result = detect_anomalies(df_feat, baseline_model, type('Dummy', (), {'decision_function': lambda self, X: np.zeros(len(X))})())
    assert not result["is_anomaly"].any()

def test_duplicate_timestamp_removal(baseline_model):
    df = generate_hourly_data("2023-01-08", 24, lambda ts: 100)
    # Introduce a duplicate row
    duplicate = df.iloc[10:11]
    df_dup = pd.concat([df, duplicate], ignore_index=True)
    df_clean = preprocess(df_dup)
    # Duplicate timestamp should be removed, resulting in original length
    assert len(df_clean) == 24
    df_feat = engineer_features(df_clean)
    result = detect_anomalies(df_feat, baseline_model, type('Dummy', (), {'decision_function': lambda self, X: np.zeros(len(X))})())
    assert not result["is_anomaly"].any()

def test_extreme_value_invalid_handling(baseline_model):
    def value(ts):
        if ts.hour == 3:
            return -50  # negative, invalid
        if ts.hour == 4:
            return 1_000_000  # absurdly high, invalid
        return 100
    df = generate_hourly_data("2023-01-08", 24, value)
    df_clean = preprocess(df)
    # Invalid rows should be removed, length < 24
    assert len(df_clean) < 24
    df_feat = engineer_features(df_clean)
    result = detect_anomalies(df_feat, baseline_model, type('Dummy', (), {'decision_function': lambda self, X: np.zeros(len(X))})())
    # Remaining rows should not be flagged as anomalies
    assert not result["is_anomaly"].any()
