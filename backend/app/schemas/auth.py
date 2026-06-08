from pydantic import BaseModel, Field, field_validator

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str | None = None
    exp: int | None = None

class LoginSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=72)

class ChangePasswordSchema(BaseModel):
    old_password: str = Field(..., min_length=4, max_length=72)
    new_password: str = Field(..., min_length=8, max_length=72)
    auth_code: str = Field(..., min_length=1)

    @field_validator("old_password", "new_password")
    @classmethod
    def validate_bcrypt_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must not exceed 72 UTF-8 bytes")
        return value
