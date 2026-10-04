import io


def test_valid_csv_upload(client):
    b_res = client.post("/api/buildings", json={"name": "CSV Building", "location": "Mumbai"})
    b_id = b_res.json()["id"]

    csv_data = (
        "timestamp,energy_kwh,temperature,occupancy\n"
        "2026-10-01T08:00:00Z,85.5,24.2,45\n"
        "2026-10-01T09:00:00Z,91.2,25.1,52\n"
        "2026-10-01T10:00:00Z,98.7,26.0,61\n"
    ).encode("utf-8")

    files = {"file": ("test.csv", io.BytesIO(csv_data), "text/csv")}
    response = client.post(f"/api/energy/upload", files=files, data={"building_id": b_id})

    assert response.status_code == 200
    data = response.json()
    assert data["records_received"] == 3
    assert data["records_valid"] == 3
    assert data["records_rejected"] == 0
    assert data["processing_status"] == "completed"


def test_missing_required_column(client):
    csv_data = (
        "temperature,occupancy\n"
        "24.2,45\n"
    ).encode("utf-8")

    files = {"file": ("test.csv", io.BytesIO(csv_data), "text/csv")}
    response = client.post("/api/energy/upload", files=files)

    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "MISSING_REQUIRED_COLUMNS"


def test_csv_with_invalid_and_duplicate_rows(client):
    b_res = client.post("/api/buildings", json={"name": "Building Test", "location": "Pune"})
    b_id = b_res.json()["id"]

    csv_data = (
        "timestamp,energy_kwh,temperature,occupancy\n"
        "2026-10-01T08:00:00Z,85.5,24.2,45\n"
        "2026-10-01T09:00:00Z,-15.0,25.1,52\n"  # Invalid negative energy
        "2026-10-01T08:00:00Z,90.0,26.0,61\n"  # Duplicate timestamp in batch
    ).encode("utf-8")

    files = {"file": ("test.csv", io.BytesIO(csv_data), "text/csv")}
    response = client.post("/api/energy/upload", files=files, data={"building_id": b_id})

    assert response.status_code == 200
    data = response.json()
    assert data["records_received"] == 3
    assert data["records_valid"] == 1
    assert data["records_rejected"] == 2
    assert len(data["errors"]) == 2


def test_oversized_csv_rejection(client):
    # Instantaneous allocation of content exceeding 10 MB limit
    large_csv = b"timestamp,energy_kwh\n" + (b"X" * (10 * 1024 * 1024 + 100))

    files = {"file": ("large.csv", io.BytesIO(large_csv), "text/csv")}
    response = client.post("/api/energy/upload", files=files)

    assert response.status_code == 413
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "FILE_TOO_LARGE"

