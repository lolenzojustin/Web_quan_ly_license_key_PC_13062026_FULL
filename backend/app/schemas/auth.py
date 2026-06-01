from pydantic import BaseModel, Field

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str | None = None
    exp: int | None = None

class LoginSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)

class ChangePasswordSchema(BaseModel):
    old_password: str = Field(..., min_length=4)
    new_password: str = Field(..., min_length=4)
