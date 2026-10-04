from sqlalchemy import ForeignKey, Float, String, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Baseline(Base):
    __tablename__ = "baselines"

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
    expected_energy_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(100), default="ml_service", nullable=False)
    created_at: Mapped[utc_now] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    building = relationship("Building", back_populates="baselines")

    __table_args__ = (
        Index("idx_baseline_building_timestamp", "building_id", "timestamp"),
    )
