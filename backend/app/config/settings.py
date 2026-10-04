from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "WattWise Backend"
    APP_ENV: str = "development"
    DATABASE_URL: str = "postgresql+psycopg://postgres:password@localhost:5432/wattwise"
    ML_SERVICE_URL: str = "http://localhost:8001"
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000"
    MAX_CSV_SIZE_MB: int = 10
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                # Handle JSON array string if passed
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()
