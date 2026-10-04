# WattWise — Smart Energy Anomaly Detection System (Backend)

WattWise Backend is a production-quality FastAPI microservice designed to ingest building energy consumption data, perform data validation and cleaning, interface with an external Machine Learning (ML) prediction service, store factual baselines and anomaly reports in PostgreSQL, and expose REST APIs for frontend integration.

---

## 🏗 Architecture & Control Flow

```text
Energy Data (CSV / API)
        │
        ▼
   FastAPI App (/api)
        │
        ▼
Validation & Data Cleaning
        │
        ▼
 PostgreSQL Database (SQLAlchemy 2.x)
        │
        ▼
 ML Service Interface (httpx -> POST /internal/ml/predict)
        │
        ▼
 Stored Results (Baseline & Anomaly Tables)
        │
        ▼
 REST API Endpoints (Dashboard, Energy, Anomalies, Cost)
        │
        ▼
   Frontend (Member 1)
```

---

## 📋 Requirements

* **Python**: 3.11+ (Python 3.12 supported)
* **Database**: PostgreSQL 14+ (or SQLite for local unit testing)
* **Key Dependencies**: FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, Pandas, Uvicorn, httpx, slowapi, pytest

---

## 🚀 Setup & Installation Instructions

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Create Virtual Environment

**Windows:**
```cmd
python -m venv .venv
.venv\Scripts\activate
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:

**Windows:**
```cmd
copy .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

Default `.env` configuration:

```env
APP_NAME=WattWise Backend
APP_ENV=development
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/wattwise
ML_SERVICE_URL=http://localhost:8001
CORS_ORIGINS=http://localhost:3000
MAX_CSV_SIZE_MB=10
RATE_LIMIT_PER_MINUTE=60
```

### 5. Run Database Migrations

Ensure PostgreSQL is running and database `wattwise` is created, then execute:

```bash
alembic upgrade head
```

### 6. Seed Demo Data (Optional)

Generate realistic deterministic demo data with controlled anomaly:

```bash
python scripts/seed_database.py --seed 42
```

### 7. Run FastAPI Server

```bash
uvicorn app.main:app --reload
```

* **API Root**: [http://localhost:8000](http://localhost:8000)
* **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **OpenAPI Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

## 📊 Database Schema

```text
Building (1) ───< EnergyReading (N)
   │
   ├───< Baseline (N)
   │
   └───< Anomaly (N) ───< Investigation (1)
```

### 1. `buildings`
* `id`: Primary Key (Autoincrement Integer)
* `name`: String(255), Required
* `location`: String(255), Required
* `tariff`: Float, Default `8.00`
* `created_at`: Timezone-aware UTC DateTime

### 2. `energy_readings`
* `id`: Primary Key (Autoincrement Integer)
* `building_id`: Foreign Key (`buildings.id`, ON DELETE CASCADE)
* `timestamp`: Timezone-aware UTC DateTime
* `energy_kwh`: Float (Required, non-negative)
* `temperature`: Float (Optional)
* `occupancy`: Integer (Optional, non-negative)
* `created_at`: Timezone-aware UTC DateTime
* **Indexes**: `building_id`, `timestamp`, Composite Index `(building_id, timestamp)`
* **Constraint**: `UniqueConstraint(building_id, timestamp)` for duplicate prevention

### 3. `baselines`
* `id`: Primary Key (Autoincrement Integer)
* `building_id`: Foreign Key (`buildings.id`, ON DELETE CASCADE)
* `timestamp`: Timezone-aware UTC DateTime
* `expected_energy_kwh`: Float (Stored baseline value from ML service)
* `source`: String(100), Default `"ml_service"`
* `created_at`: Timezone-aware UTC DateTime

### 4. `anomalies`
* `id`: Primary Key (Autoincrement Integer)
* `building_id`: Foreign Key (`buildings.id`, ON DELETE CASCADE)
* `energy_reading_id`: Foreign Key (`energy_readings.id`, ON DELETE SET NULL)
* `timestamp`: Timezone-aware UTC DateTime
* `actual_energy_kwh`: Float
* `expected_energy_kwh`: Float
* `excess_kwh`: Float (`actual_energy_kwh - expected_energy_kwh`)
* `anomaly_score`: Float
* `anomaly_status`: String(50) (`"normal"`, `"warning"`, `"anomaly"`)
* `created_at`: Timezone-aware UTC DateTime

### 5. `investigations`
* `id`: Primary Key (Autoincrement Integer)
* `anomaly_id`: Foreign Key (`anomalies.id`, ON DELETE CASCADE)
* `status`: String(50) (`"open"`, `"investigating"`, `"resolved"`)
* `notes`: Text (Optional)
* `created_at`: Timezone-aware UTC DateTime
* `updated_at`: Timezone-aware UTC DateTime

---

## 📁 CSV Data Ingestion & Validation

### API Endpoint
`POST /api/energy/upload`

### File Format
* Accepts `.csv` files up to `MAX_CSV_SIZE_MB` (default 10 MB).
* Headers are case-insensitive and space-trimmed.

### Columns
* **Required**:
  - `timestamp`: ISO 8601 string (e.g. `2026-10-01T08:00:00Z`)
  - `energy_kwh`: Numeric value (>= 0)
* **Optional**:
  - `temperature`: Numeric value
  - `occupancy`: Non-negative integer
  - `building_id`: Integer
  - `tariff`: Numeric value

### Sample CSV (`sample_data/sample_energy.csv`)
```csv
timestamp,energy_kwh,temperature,occupancy,building_id,tariff
2026-10-01T08:00:00Z,85.5,24.2,45,1,8
2026-10-01T09:00:00Z,91.2,25.1,52,1,8
2026-10-01T10:00:00Z,180.0,26.0,61,1,8
```

---

## 🔌 ML Service Integration Guide (For Member 3)

The backend isolates all communication with Member 3's ML Service inside `app/services/ml_service.py`.

### Target Endpoint Configured
```http
POST /internal/ml/predict
```

### Configurable URL
Set `ML_SERVICE_URL` in `.env`:
```env
ML_SERVICE_URL=http://localhost:8001
```

### Request Payload Sent by Backend
```json
{
  "building_id": 1,
  "timestamp": "2026-10-01T10:00:00Z",
  "actual_energy_kwh": 180.0,
  "features": {
    "temperature": 26.0,
    "occupancy": 61
  }
}
```

### Expected Response Payload from ML Service
```json
{
  "expected_energy_kwh": 100.0,
  "anomaly_score": 0.95,
  "anomaly_status": "anomaly"
}
```

### Graceful Fallback
If the ML service is unreachable or offline, the backend:
1. Logs a warning (`"ML service communication failed"`).
2. Keeps the raw energy reading safely stored in PostgreSQL.
3. Does NOT fabricate predictions or crash API responses.

---

## 📌 REST API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check |
| `GET` | `/api/buildings` | List all buildings |
| `POST` | `/api/buildings` | Create a building (`name`, `location`, `tariff`) |
| `GET` | `/api/buildings/{id}` | Get building details by ID |
| `GET` | `/api/energy` | Query energy readings (`buildingId`, `startDate`, `endDate`) |
| `POST` | `/api/energy` | Create a single energy reading |
| `GET` | `/api/energy/{buildingId}` | Get energy readings for a building |
| `POST` | `/api/energy/upload` | Upload CSV energy data |
| `GET` | `/api/dashboard/summary` | Get summary metrics (`currentUsage`, `expectedUsage`, `excessCost`, etc.) |
| `GET` | `/api/anomalies` | Query anomalies (`buildingId`, `startDate`, `endDate`, `status`) |
| `GET` | `/api/anomalies/{id}` | Get anomaly details by ID |
| `GET` | `/api/anomalies/{id}/timeline` | Get anomaly contextual timeline readings |
| `GET` | `/api/cost-impact` | Calculate cost impact (`buildingId`, `period`: daily/weekly/monthly/custom) |

---

## 🧪 Running Tests

Execute pytest suite:

```bash
pytest -v
```

---

## 🎲 Demo Data Generation Script

To generate a reproducible sample CSV file:

```bash
python scripts/generate_demo_data.py --seed 42 --days 7 --output sample_data/sample_energy.csv
```
