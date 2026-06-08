from datetime import datetime
import uuid
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class ClientActivateRequest(BaseModel):
    license_key: str = Field(..., min_length=1, max_length=255)
    device_id: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=255)
    device_name: Optional[str] = Field(default=None, max_length=255)
    os_info: Optional[str] = Field(default=None, max_length=255)
    app_version: Optional[str] = Field(default=None, max_length=255)

    @field_validator("license_key")
    @classmethod
    def normalize_license_key(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("license_key must not be blank")
        return normalized

    @field_validator("device_id")
    @classmethod
    def normalize_device_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("device_id must not be blank")
        return normalized

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("category must not be blank")
        return normalized

class ClientActivateResponse(BaseModel):
    status: str
    license_key: str
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_lifetime: bool
    max_devices: int
    active_devices: int

class ClientCheckRequest(BaseModel):
    license_key: str = Field(..., min_length=1, max_length=255)
    device_id: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=255)

    @field_validator("license_key")
    @classmethod
    def normalize_license_key(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("license_key must not be blank")
        return normalized

    @field_validator("device_id")
    @classmethod
    def normalize_device_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("device_id must not be blank")
        return normalized

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("category must not be blank")
        return normalized

class ClientCheckResponse(BaseModel):
    status: str
    expires_at: Optional[datetime] = None
    server_time: datetime

class ActivationOut(BaseModel):
    id: uuid.UUID
    license_id: uuid.UUID
    device_id: str
    device_name: Optional[str] = None
    os_info: Optional[str] = None
    app_version: Optional[str] = None
    activated_at: datetime
    last_checked_at: Optional[datetime] = None

    class Config:
        from_attributes = True
