from datetime import datetime
import uuid
from typing import Optional
from pydantic import BaseModel, Field

class ClientActivateRequest(BaseModel):
    license_key: str = Field(..., min_length=1, max_length=255)
    device_id: str = Field(..., min_length=1, max_length=255)
    device_name: Optional[str] = Field(default=None, max_length=255)
    os_info: Optional[str] = Field(default=None, max_length=255)
    app_version: Optional[str] = Field(default=None, max_length=255)

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
