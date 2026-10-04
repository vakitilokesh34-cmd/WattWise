import os
import sys

# Set DATABASE_URL before importing app modules
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.database.database as app_db
from app.database.base import Base
from app.main import app

# Shared in-memory SQLite engine for tests using StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

# Set app's engine and SessionLocal to test_engine
app_db.engine = test_engine
app_db.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


from unittest.mock import patch

@pytest.fixture(scope="function", autouse=True)
def mock_ml_service():
    """Mocks ML service call during unit tests for instantaneous execution."""
    with patch("app.services.ml_service.ml_service.predict_energy", return_value=None):
        yield


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Creates fresh in-memory database tables before each test and cleans up after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)



@pytest.fixture(scope="function")
def db_session():
    """Provides a database session for direct test setup."""
    session = app_db.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client():
    """FastAPI TestClient using the shared test database."""
    with TestClient(app) as c:
        yield c
