import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base
from app.core.timezone import now_vn

class License(Base):
    __tablename__ = "licenses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    duration_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'days', 'months', 'years', 'lifetime'
    duration_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_devices: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_lifetime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="new", nullable=False)  # 'new', 'active', 'expired', 'revoked'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_vn, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_vn, onupdate=now_vn, nullable=False)

    # Relationships
    category: Mapped["Category"] = relationship(back_populates="licenses")
    activations: Mapped[List["LicenseActivation"]] = relationship(
        back_populates="license", cascade="all, delete-orphan"
    )
