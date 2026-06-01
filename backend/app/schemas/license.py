from datetime import datetime
import uuid
from typing import Optional
from pydantic import BaseModel, Field, model_validator

class LicenseCreate(BaseModel):
    quantity: int = Field(default=1, ge=1, le=100)
    duration_type: str = Field(..., description="days, months, years, or lifetime")
    duration_value: Optional[int] = Field(default=None, ge=1)
    max_devices: int = Field(default=1, ge=1)
    category_id: uuid.UUID

    @model_validator(mode="after")
    def validate_duration(self) -> "LicenseCreate":
        if self.duration_type != "lifetime" and self.duration_value is None:
            raise ValueError("duration_value is required when duration_type is not 'lifetime'")
        if self.duration_type == "lifetime":
            self.duration_value = None
        if self.duration_type not in ["days", "months", "years", "lifetime"]:
            raise ValueError("duration_type must be one of: days, months, years, lifetime")
        return self

class LicenseRenew(BaseModel):
    duration_type: str = Field(..., description="days, months, years, or lifetime")
    duration_value: Optional[int] = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_duration(self) -> "LicenseRenew":
        if self.duration_type != "lifetime" and self.duration_value is None:
            raise ValueError("duration_value is required when duration_type is not 'lifetime'")
        if self.duration_type == "lifetime":
            self.duration_value = None
        if self.duration_type not in ["days", "months", "years", "lifetime"]:
            raise ValueError("duration_type must be one of: days, months, years, lifetime")
        return self

class LicenseOut(BaseModel):
    id: uuid.UUID
    key: str
    category_id: uuid.UUID
    category_name: Optional[str] = None
    duration_type: str
    duration_value: Optional[int] = None
    max_devices: int
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_lifetime: bool
    status: str
    created_at: datetime
    updated_at: datetime
    devices_count: int = 0

    class Config:
        from_attributes = True
