import sys
import os
import argparse

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import SessionLocal
from app.services.demo_data_service import seed_demo_data_to_db


def main():
    parser = argparse.ArgumentParser(description="Seed WattWise database with deterministic demo data.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible generation (default: 42)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        print(f"Seeding database with demo data (Seed: {args.seed})...")
        building, readings_count, anomalies_count = seed_demo_data_to_db(db, seed=args.seed)
        print(f"Success! Building '{building.name}' (ID: {building.id}) seeded with {readings_count} energy readings and {anomalies_count} anomaly records.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
