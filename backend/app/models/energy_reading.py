from typing import Optional
from sqlalchemy import ForeignKey, Float, Integer, DateTime, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class EnergyReading(Base):
    __tablename__ = "energy_readings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    timestamp: Mapped[utc_now] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    energy_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    occupancy: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[utc_now] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    building = relationship("Building", back_populates="energy_readings")
    anomalies = relationship("Anomaly", back_populates="energy_reading")

    __table_args__ = (
        Index("idx_building_timestamp", "building_id", "timestamp"),
        UniqueConstraint("building_id", "timestamp", name="uix_building_timestamp"),
    )
