from sqlalchemy import String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    tariff: Mapped[float] = mapped_column(Float, nullable=False, default=8.00)
    created_at: Mapped[utc_now] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    energy_readings = relationship("EnergyReading", back_populates="building", cascade="all, delete-orphan")
    baselines = relationship("Baseline", back_populates="building", cascade="all, delete-orphan")
    anomalies = relationship("Anomaly", back_populates="building", cascade="all, delete-orphan")
