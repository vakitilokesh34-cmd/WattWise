from datetime import datetime, timezone
from app.models.building import Building
from app.models.anomaly import Anomaly


def test_cost_impact_calculation(client, db_session):
    building = Building(name="Building 1", location="Hyderabad", tariff=8.00)
    db_session.add(building)
    db_session.commit()
    db_session.refresh(building)

    ts = datetime.now(timezone.utc)

    # Controlled Anomaly: Actual=180, Expected=100 -> Excess=80 * 8 = 640
    anomaly = Anomaly(
        building_id=building.id,
        timestamp=ts,
        actual_energy_kwh=180.0,
        expected_energy_kwh=100.0,
        excess_kwh=80.0,
        anomaly_score=0.95,
        anomaly_status="anomaly"
    )
    db_session.add(anomaly)
    db_session.commit()

    res = client.get(f"/api/cost-impact?buildingId={building.id}&period=weekly")
    assert res.status_code == 200
    data = res.json()
    assert data["buildingId"] == building.id
    assert data["actualEnergyKwh"] == 180.0
    assert data["expectedEnergyKwh"] == 100.0
    assert data["excessKwh"] == 80.0
    assert data["tariff"] == 8.00
    assert data["totalCostImpact"] == 640.0
    assert len(data["breakdown"]) == 1
