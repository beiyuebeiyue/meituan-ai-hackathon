from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.users import UserRead


class RegisterRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=20, pattern=r"^1\d{10}$")
    password: str = Field(min_length=5, max_length=128)
    username: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=20, pattern=r"^1\d{10}$")
    password: str = Field(min_length=5, max_length=128)
    requested_role: Literal["consumer", "merchant"] | None = None

    @model_validator(mode="before")
    @classmethod
    def support_legacy_identifier_field(cls, value: object) -> object:
        if isinstance(value, dict) and value.get("phone") is None:
            if value.get("identifier") is not None:
                value = {**value, "phone": value["identifier"]}
            elif value.get("email") is not None:
                value = {**value, "phone": value["email"]}
        return value


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
