import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error
from typing import Tuple


def mae(y_true: pd.Series, y_pred: pd.Series) -> float:
    """Mean Absolute Error."""
    return mean_absolute_error(y_true, y_pred)


def rmse(y_true: pd.Series, y_pred: pd.Series) -> float:
    """Root Mean Squared Error."""
    return np.sqrt(mean_squared_error(y_true, y_pred))


def mape(y_true: pd.Series, y_pred: pd.Series) -> float:
    """Mean Absolute Percentage Error.

    Returns ``np.nan`` if all true values are zero.
    """
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    nonzero = y_true != 0
    if not np.any(nonzero):
        return np.nan
    return np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero])) * 100


def classification_metrics(
    y_true: pd.Series, y_pred: pd.Series
) -> Tuple[float, float, float]:
    """Calculate precision, recall, and F1 score.

    Parameters
    ----------
    y_true : pd.Series of bool or 0/1
        Ground‑truth anomaly labels.
    y_pred : pd.Series of bool or 0/1
        Predicted anomaly flags.
    """
    tp = ((y_true == 1) & (y_pred == 1)).sum()
    fp = ((y_true == 0) & (y_pred == 1)).sum()
    fn = ((y_true == 1) & (y_pred == 0)).sum()
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )
    return precision, recall, f1
