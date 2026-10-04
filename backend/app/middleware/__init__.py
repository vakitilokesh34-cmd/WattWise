# app/middleware/__init__.py
from app.middleware.rate_limit import limiter

__all__ = ["limiter"]
