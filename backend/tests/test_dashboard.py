from datetime import datetime, timezone
from app.models.building import Building
from app.models.energy_reading import EnergyReading
from app.models.baseline import Baseline
from app.models.anomaly import Anomaly


def test_dashboard_summary_without_baseline(client):
    b_res = client.post("/api/buildings", json={"name": "Building 1", "location": "Chennai"})
    b_id = b_res.json()["id"]

    client.post("/api/energy", json={
        "buildingId": b_id,
        "timestamp": "2026-10-01T10:00:00Z",
        "energyKwh": 180.0
    })

    res = client.get(f"/api/dashboard/summary?buildingId={b_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["currentUsage"] == 180.0
    assert data["expectedUsage"] is None
    assert data["excessEnergy"] is None
    assert data["estimatedExcessCost"] is None


def test_dashboard_summary_with_baseline_and_anomaly(client, db_session):
    building = Building(name="Building 1", location="Chennai", tariff=8.00)
    db_session.add(building)
    db_session.commit()
    db_session.refresh(building)

    ts = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)

    reading = EnergyReading(building_id=building.id, timestamp=ts, energy_kwh=180.0)
    baseline = Baseline(building_id=building.id, timestamp=ts, expected_energy_kwh=100.0)
    anomaly = Anomaly(
        building_id=building.id,
        energy_reading_id=reading.id,
        timestamp=ts,
        actual_energy_kwh=180.0,
        expected_energy_kwh=100.0,
        excess_kwh=80.0,
        anomaly_score=0.95,
        anomaly_status="anomaly"
    )

    db_session.add_all([reading, baseline, anomaly])
    db_session.commit()

    res = client.get(f"/api/dashboard/summary?buildingId={building.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["currentUsage"] == 180.0
    assert data["expectedUsage"] == 100.0
    assert data["excessEnergy"] == 80.0
    assert data["estimatedExcessCost"] == 640.0
    assert data["activeAnomalies"] == 1
    assert data["energyEfficiency"] == 55.56
