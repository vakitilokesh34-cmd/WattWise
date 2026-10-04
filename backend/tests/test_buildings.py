def test_create_building(client):
    payload = {
        "name": "Main Building",
        "location": "Hyderabad",
        "tariff": 8.5
    }
    response = client.post("/api/buildings", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Main Building"
    assert data["location"] == "Hyderabad"
    assert data["tariff"] == 8.5
    assert "id" in data


def test_create_building_default_tariff(client):
    payload = {
        "name": "Secondary Annex",
        "location": "Bengaluru"
    }
    response = client.post("/api/buildings", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["tariff"] == 8.00


def test_list_buildings(client):
    client.post("/api/buildings", json={"name": "B1", "location": "L1"})
    client.post("/api/buildings", json={"name": "B2", "location": "L2"})

    response = client.get("/api/buildings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_get_building_by_id(client):
    create_res = client.post("/api/buildings", json={"name": "B1", "location": "L1"})
    b_id = create_res.json()["id"]

    get_res = client.get(f"/api/buildings/{b_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "B1"


def test_get_nonexistent_building(client):
    response = client.get("/api/buildings/9999")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"
