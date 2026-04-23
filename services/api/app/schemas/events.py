from pydantic import BaseModel, Field


class StyleEventInput(BaseModel):
    style_id: str
    event_type: str
    source: str
    count: int = Field(default=1, ge=1, le=1000)


class StyleEventBatchRequest(BaseModel):
    items: list[StyleEventInput]
