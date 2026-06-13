from datetime import datetime
import uuid
from pydantic import BaseModel, Field, field_validator, HttpUrl

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("name must contain at least 2 non-whitespace characters")
        return normalized

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: uuid.UUID
    version: str | None = None
    update_url: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CategoryUpdateVersion(BaseModel):
    version: str = Field(..., min_length=1, max_length=50)
    update_url: str | None = Field(default=None, max_length=2000)
