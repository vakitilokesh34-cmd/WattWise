import pathlib

# Configuration for WattWise ML pipeline
BASELINE_MODEL_PATH = pathlib.Path(__file__).parent / "models" / "baseline.pkl"
ANOMALY_MODEL_PATH = pathlib.Path(__file__).parent / "models" / "anomaly.pkl"

# Feature engineering parameters
ROLLING_WINDOW = 24  # hours, assuming hourly data after resampling
LAG_1 = 1
LAG_24 = 24

# Anomaly detection parameters
ISOLATION_FRACTION = 0.05  # proportion of points expected to be anomalies
ANOMALY_SCORE_THRESHOLD = 0.8  # above this considered anomaly

# Resampling frequency
RESAMPLE_FREQ = "H"  # hourly

# Random seed for reproducibility
RANDOM_SEED = 42
