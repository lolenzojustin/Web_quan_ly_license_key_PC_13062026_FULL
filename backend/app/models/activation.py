import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base
from app.core.timezone import now_vn

class LicenseActivation(Base):
    __tablename__ = "license_activations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    license_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("licenses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    device_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    os_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    app_version: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_vn, nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    license: Mapped["License"] = relationship(back_populates="activations")

    # Constraints
    __table_args__ = (
        UniqueConstraint("license_id", "device_id", name="uq_license_device"),
    )
