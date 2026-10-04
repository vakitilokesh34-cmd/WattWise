from typing import Optional
from sqlalchemy import ForeignKey, Float, String, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    energy_reading_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("energy_readings.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    timestamp: Mapped[utc_now] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    actual_energy_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    expected_energy_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    excess_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_status: Mapped[str] = mapped_column(String(50), nullable=False, default="normal")
    created_at: Mapped[utc_now] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    building = relationship("Building", back_populates="anomalies")
    energy_reading = relationship("EnergyReading", back_populates="anomalies")
    investigations = relationship("Investigation", back_populates="anomaly", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_anomaly_building_timestamp", "building_id", "timestamp"),
    )
