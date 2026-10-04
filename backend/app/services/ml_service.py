import logging
from typing import Optional, Dict, Any
from datetime import datetime
import httpx
from app.config.settings import settings
from app.utils.datetime_utils import format_iso

logger = logging.getLogger("wattwise.ml_service")


class MLService:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.ML_SERVICE_URL).rstrip("/")

    async def predict_energy_async(
        self,
        building_id: int,
        timestamp: datetime,
        actual_energy_kwh: float,
        temperature: Optional[float] = None,
        occupancy: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Communicates with external ML service at POST /internal/ml/predict.
        Returns prediction payload or None if unavailable/error occurs.
        """
        endpoint = f"{self.base_url}/internal/ml/predict"
        payload = {
            "building_id": building_id,
            "timestamp": format_iso(timestamp),
            "actual_energy_kwh": actual_energy_kwh,
            "features": {
                "temperature": temperature,
                "occupancy": occupancy
            }
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(endpoint, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    logger.info("ML prediction succeeded for building %s at %s", building_id, timestamp)
                    return data
                else:
                    logger.warning(
                        "ML service returned non-200 status code: %s body: %s",
                        response.status_code, response.text
                    )
                    return None
        except httpx.RequestError as exc:
            logger.warning("ML service communication failed (service unavailable or offline): %s", exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error communicating with ML service: %s", exc)
            return None

    def predict_energy(
        self,
        building_id: int,
        timestamp: datetime,
        actual_energy_kwh: float,
        temperature: Optional[float] = None,
        occupancy: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Synchronous wrapper around predict_energy_async using httpx.Client.
        """
        endpoint = f"{self.base_url}/internal/ml/predict"
        payload = {
            "building_id": building_id,
            "timestamp": format_iso(timestamp),
            "actual_energy_kwh": actual_energy_kwh,
            "features": {
                "temperature": temperature,
                "occupancy": occupancy
            }
        }

        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.post(endpoint, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    logger.info("ML prediction succeeded for building %s at %s", building_id, timestamp)
                    return data
                else:
                    logger.warning(
                        "ML service returned status code %s: %s",
                        response.status_code, response.text
                    )
                    return None
        except httpx.RequestError as exc:
            logger.warning("ML service communication failed (service unavailable or offline): %s", exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error communicating with ML service: %s", exc)
            return None


ml_service = MLService()
