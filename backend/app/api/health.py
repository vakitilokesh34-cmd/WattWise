from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Health Check")
def health_check():
    return {
        "status": "ok",
        "service": "wattwise-backend"
    }
