# app/api/__init__.py
from app.api.health import router as health_router
from app.api.buildings import router as buildings_router
from app.api.energy import router as energy_router
from app.api.dashboard import router as dashboard_router
from app.api.anomalies import router as anomalies_router
from app.api.cost import router as cost_router

__all__ = [
    "health_router",
    "buildings_router",
    "energy_router",
    "dashboard_router",
    "anomalies_router",
    "cost_router",
]
