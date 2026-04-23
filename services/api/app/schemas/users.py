from datetime import datetime

from pydantic import BaseModel


class UserRead(BaseModel):
    id: str
    email: str
    phone: str | None = None
    username: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserHandPhotoRead(BaseModel):
    id: str
    image_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserHandPhotoListResponse(BaseModel):
    items: list[UserHandPhotoRead]
