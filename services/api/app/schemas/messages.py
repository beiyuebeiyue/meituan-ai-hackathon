from datetime import datetime

from pydantic import BaseModel


class DirectMessageTargetRead(BaseModel):
    id: str
    uid: int
    username: str
    role: str
    is_shop: bool = False
    avatar_url: str | None = None


class DirectMessageSharedStyleRead(BaseModel):
    id: str
    title: str
    image_url: str
    author_name: str
    author_avatar_url: str | None = None
    author_is_shop: bool = False
    like_count: int = 0


class DirectMessageBookingInviteRead(BaseModel):
    shop_id: str
    shop_name: str
    shop_city: str
    shop_address: str | None = None


class DirectMessageRead(BaseModel):
    id: str
    sender_user_id: str
    recipient_user_id: str
    content: str
    image_url: str | None = None
    shared_style: DirectMessageSharedStyleRead | None = None
    booking_invite: DirectMessageBookingInviteRead | None = None
    created_at: datetime
    is_mine: bool
    read_at: datetime | None = None


class DirectMessageThreadRead(BaseModel):
    target: DirectMessageTargetRead
    items: list[DirectMessageRead]
    can_send: bool
    is_mutual_follow: bool
    viewer_follows_target: bool
    blocked_by_target: bool
    viewer_has_blocked_target: bool
    notice: str | None = None


class DirectMessageCreateRequest(BaseModel):
    content: str


class DirectMessageStyleCreateRequest(BaseModel):
    style_id: str
    content: str = ""


class DirectMessageBookingInviteCreateRequest(BaseModel):
    shop_id: str | None = None
    content: str = ""


class MessageInboxThreadRead(BaseModel):
    target: DirectMessageTargetRead
    last_message_preview: str
    last_message_at: datetime
    last_message_is_mine: bool
    unread_count: int
    is_muted: bool = False
    is_stranger_source: bool
    can_send: bool
    is_mutual_follow: bool
    viewer_follows_target: bool
    blocked_by_target: bool
    viewer_has_blocked_target: bool


class StrangerBucketSummaryRead(BaseModel):
    unread_count: int
    thread_count: int
    latest_message_preview: str | None = None
    latest_message_at: datetime | None = None


class MessageBadgeSummaryRead(BaseModel):
    has_stranger_unread: bool
    main_unread_count: int


class MessageInboxRead(BaseModel):
    stranger_bucket: StrangerBucketSummaryRead | None = None
    items: list[MessageInboxThreadRead]
    badge: MessageBadgeSummaryRead


class StrangerMessageListRead(BaseModel):
    items: list[MessageInboxThreadRead]
