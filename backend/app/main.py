import logging
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded

from app.config.settings import settings
from app.database.database import engine
from app.database.base import Base
from app.middleware.rate_limit import limiter
from app.utils.validation import WattWiseException
from app.api import (
    health_router,
    buildings_router,
    energy_router,
    dashboard_router,
    anomalies_router,
    cost_router,
)

# Configure Application Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("wattwise.main")

# Auto-create tables if database is available (Alembic manages formal migrations)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning("Auto table creation skipped (Database connection offline or pending migration): %s", e)


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for WattWise Smart Energy Anomaly Detection System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Attach Slowapi Rate Limiter
app.state.limiter = limiter

# CORS Configuration
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api prefix
api_prefix = "/api"
app.include_router(health_router, prefix=api_prefix)
app.include_router(buildings_router, prefix=api_prefix)
app.include_router(energy_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(anomalies_router, prefix=api_prefix)
app.include_router(cost_router, prefix=api_prefix)


# Custom Global Exception Handlers
@app.exception_handler(WattWiseException)
async def wattwise_exception_handler(request: Request, exc: WattWiseException):
    logger.warning("WattWiseException [%s]: %s (Path: %s)", exc.code, exc.message, request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )


from fastapi.encoders import jsonable_encoder

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_msg = errors[0].get("msg") if errors else "Validation error"
    logger.warning("Validation error on %s: %s", request.url.path, errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"Input validation error: {first_msg}",
                "details": jsonable_encoder(errors)
            }
        }
    )



@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "RESOURCE_NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": str(exc.detail)
            }
        }
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please slow down."
            }
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled internal server error on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred. Please contact system administrator."
            }
        }
    )


@app.get("/", include_in_schema=False)
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "health": "/api/health"
    }
