import argparse
import json
from pathlib import Path
import pandas as pd

from ml.preprocessing import preprocess
from ml.features import engineer_features
from ml.baseline import train_baseline, save_baseline
from ml.anomaly import train_anomaly_detector, save_anomaly_model
from ml.config import BASELINE_MODEL_PATH, ANOMALY_MODEL_PATH

def main():
    parser = argparse.ArgumentParser(description="Train WattWise ML models")
    parser.add_argument("csv_path", type=Path, help="Path to raw energy CSV file")
    parser.add_argument("--model_version", default="v1.0", help="Version identifier for the trained model")
    args = parser.parse_args()

    # Load raw data
    raw_df = pd.read_csv(args.csv_path)

    # Preprocess and engineer features
    clean_df = preprocess(raw_df)
    feat_df = engineer_features(clean_df)

    # Train baseline model
    baseline_model = train_baseline(feat_df)
    save_baseline(baseline_model, BASELINE_MODEL_PATH)

    # Train anomaly detector (IsolationForest)
    anomaly_model = train_anomaly_detector(feat_df)
    save_anomaly_model(anomaly_model, ANOMALY_MODEL_PATH)

    # Write version metadata (shared for both models)
    version_info = {
        "model_name": "wattwise",
        "model_version": args.model_version,
        "training_timestamp": pd.Timestamp.now().isoformat(),
        "training_data_range": {
            "start": str(raw_df["timestamp"].min()),
            "end": str(raw_df["timestamp"].max())
        },
        "feature_version": "v1.0"
    }
    version_path = BASELINE_MODEL_PATH.parent / "version.json"
    version_path.parent.mkdir(parents=True, exist_ok=True)
    version_path.write_text(json.dumps(version_info, indent=2))
    print(f"Training complete. Version metadata written to {version_path}")

if __name__ == "__main__":
    main()
