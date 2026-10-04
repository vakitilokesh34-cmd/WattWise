import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from joblib import dump, load
from pathlib import Path

from .config import ANOMALY_MODEL_PATH, ISOLATION_FRACTION, ANOMALY_SCORE_THRESHOLD
from .baseline import train_baseline, predict_baseline, save_baseline, load_baseline


def train_anomaly_detector(df: pd.DataFrame) -> IsolationForest:
    """Train an IsolationForest on residuals of the baseline.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame that must already contain an ``expected_kwh`` column (produced
        by the baseline) and an ``energy_kwh`` column.

    Returns
    -------
    IsolationForest
        Fitted model that can score new residuals.
    """
    # Compute residuals
    residual = df["energy_kwh"] - df["expected_kwh"]
    residual = residual.values.reshape(-1, 1)
    iso = IsolationForest(
        contamination=ISOLATION_FRACTION,
        random_state=42,
    )
    iso.fit(residual)
    return iso


def save_anomaly_model(model: IsolationForest, path: Path = ANOMALY_MODEL_PATH) -> None:
    """Persist the IsolationForest model using joblib."""
    path.parent.mkdir(parents=True, exist_ok=True)
    dump(model, path)


def load_anomaly_model(path: Path = ANOMALY_MODEL_PATH) -> IsolationForest:
    """Load a persisted IsolationForest model.

    Returns a dummy model that predicts zero anomaly score if file not found.
    """
    if not path.is_file():
        # Return a stub that yields zero scores
        class Dummy:
            def decision_function(self, X):
                return np.zeros(X.shape[0])
        return Dummy()
    return load(path)


def compute_anomaly_score(model, residuals: np.ndarray) -> np.ndarray:
    """Convert IsolationForest decision function output to a 0‑1 anomaly score.

    Higher scores indicate more anomalous.
    The raw decision function is negative for outliers; we shift and scale to
    [0, 1].
    """
    # decision_function returns larger values for normal points (positive) and
    # negative for anomalies. Invert and normalize.
    scores = -model.decision_function(residuals.reshape(-1, 1))
    # Scale to [0, 1]
    min_s, max_s = scores.min(), scores.max()
    if max_s - min_s == 0:
        return np.zeros_like(scores)
    norm = (scores - min_s) / (max_s - min_s)
    return norm


def detect_anomalies(df: pd.DataFrame, baseline_model: dict, anomaly_model) -> pd.DataFrame:
    """Detect anomalies in a DataFrame.

    Returns a DataFrame with columns:
    - expected_kwh
    - residual
    - absolute_deviation
    - relative_deviation (% of expected)
    - standardized_residual (z‑score)
    - anomaly_score (0‑1)
    - is_anomaly (bool)
    """
    df = df.copy()
    df["expected_kwh"] = predict_baseline(df, baseline_model)
    df["residual"] = df["energy_kwh"] - df["expected_kwh"]
    df["absolute_deviation"] = df["residual"].abs()
    df["relative_deviation"] = np.where(
        df["expected_kwh"] != 0,
        df["residual"] / df["expected_kwh"] * 100,
        np.nan,
    )
    # Standardized residual (z‑score) based on rolling statistics
    df["rolling_std"] = df["rolling_std"].replace(0, np.nan)
    df["standardized_residual"] = df["residual"] / df["rolling_std"]
    df["standardized_residual"] = df["standardized_residual"].fillna(0)
    # Anomaly score from IsolationForest
    residual_vals = df["residual"].values
    df["anomaly_score"] = compute_anomaly_score(anomaly_model, residual_vals)
    # Flag anomalies: either high score OR large residual (>50% of expected)
    residual_anomaly = np.abs(df["residual"]) > 0.5 * df["expected_kwh"]
    df["is_anomaly"] = (df["anomaly_score"] >= ANOMALY_SCORE_THRESHOLD) | residual_anomaly
    return df
