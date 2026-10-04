def test_create_valid_energy_reading(client):
    b_res = client.post("/api/buildings", json={"name": "Building 1", "location": "Delhi"})
    b_id = b_res.json()["id"]

    reading_payload = {
        "buildingId": b_id,
        "timestamp": "2026-10-01T10:00:00Z",
        "energyKwh": 85.5,
        "temperature": 25.0,
        "occupancy": 50
    }
    response = client.post("/api/energy", json=reading_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["buildingId"] == b_id
    assert data["energyKwh"] == 85.5
    assert data["temperature"] == 25.0
    assert data["occupancy"] == 50


def test_reject_negative_energy(client):
    b_res = client.post("/api/buildings", json={"name": "Building 1", "location": "Delhi"})
    b_id = b_res.json()["id"]

    reading_payload = {
        "buildingId": b_id,
        "timestamp": "2026-10-01T10:00:00Z",
        "energyKwh": -10.0
    }
    response = client.post("/api/energy", json=reading_payload)
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert "VALIDATION_ERROR" in data["error"]["code"]


def test_reject_invalid_timestamp(client):
    b_res = client.post("/api/buildings", json={"name": "Building 1", "location": "Delhi"})
    b_id = b_res.json()["id"]

    reading_payload = {
        "buildingId": b_id,
        "timestamp": "invalid-timestamp-str",
        "energyKwh": 50.0
    }
    response = client.post("/api/energy", json=reading_payload)
    assert response.status_code == 422


def test_duplicate_energy_reading_detection(client):
    b_res = client.post("/api/buildings", json={"name": "Building 1", "location": "Delhi"})
    b_id = b_res.json()["id"]

    reading_payload = {
        "buildingId": b_id,
        "timestamp": "2026-10-01T10:00:00Z",
        "energyKwh": 85.5
    }
    # First creation succeeds
    res1 = client.post("/api/energy", json=reading_payload)
    assert res1.status_code == 201

    # Second creation with same building and timestamp fails
    res2 = client.post("/api/energy", json=reading_payload)
    assert res2.status_code == 409
    data = res2.json()
    assert data["success"] is False
    assert data["error"]["code"] == "DUPLICATE_READING"
