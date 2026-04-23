from pydantic import BaseModel

from app.schemas.nails import NailStyleRead


class FavoriteCreateRequest(BaseModel):
    style_id: str


class FavoriteListResponse(BaseModel):
    items: list[NailStyleRead]
