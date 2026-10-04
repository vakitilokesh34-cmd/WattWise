import sys
import os
import argparse
import pandas as pd

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.demo_data_service import generate_demo_dataset
from app.utils.datetime_utils import format_iso


def main():
    parser = argparse.ArgumentParser(description="Generate deterministic demo energy dataset CSV for WattWise.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible generation (default: 42)")
    parser.add_argument("--building-id", type=int, default=1, help="Building ID (default: 1)")
    parser.add_argument("--tariff", type=float, default=8.00, help="Building electricity tariff (default: 8.00)")
    parser.add_argument("--days", type=int, default=7, help="Number of days to generate (default: 7)")
    parser.add_argument("--output", type=str, default="sample_data/sample_energy.csv", help="Output CSV file path")

    args = parser.parse_args()

    print(f"Generating demo energy dataset (Seed: {args.seed}, Days: {args.days}, Building ID: {args.building_id})...")
    records = generate_demo_dataset(
        seed=args.seed,
        building_id=args.building_id,
        tariff=args.tariff,
        days=args.days
    )

    # Format for CSV export
    csv_rows = []
    for r in records:
        csv_rows.append({
            "timestamp": format_iso(r["timestamp"]),
            "energy_kwh": r["energy_kwh"],
            "temperature": r["temperature"],
            "occupancy": r["occupancy"],
            "building_id": r["building_id"],
            "tariff": r["tariff"]
        })

    df = pd.DataFrame(csv_rows)

    # Ensure output directory exists
    output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", args.output)) if not os.path.isabs(args.output) else args.output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    df.to_csv(output_path, index=False)
    print(f"Successfully exported {len(records)} demo records to: {output_path}")


if __name__ == "__main__":
    main()
