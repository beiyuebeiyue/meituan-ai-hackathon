from datetime import datetime

from pydantic import BaseModel

from app.schemas.nails import NailStyleRead
from app.schemas.posts import AuthorPostRead


class UserRead(BaseModel):
    id: str
    uid: int
    email: str
    phone: str | None = None
    username: str
    avatar_url: str | None = None
    birthday: str | None = None
    bio: str | None = None
    location_city: str | None = None
    show_following_public: bool = True
    show_followers_public: bool = True
    show_comments_public: bool = True
    show_likes_public: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class UserHandPhotoRead(BaseModel):
    id: str
    image_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserHandPhotoListResponse(BaseModel):
    items: list[UserHandPhotoRead]


class UserBrowseHistoryRead(BaseModel):
    id: str
    style: NailStyleRead
    viewed_at: datetime


class UserBrowseHistoryListResponse(BaseModel):
    items: list[UserBrowseHistoryRead]


class UserBrowseHistoryBatchDeleteRequest(BaseModel):
    history_ids: list[str]


class UserBrowseHistoryBatchDeleteResponse(BaseModel):
    deleted_count: int


class MyStyleCommentItem(BaseModel):
    comment_id: str
    style_id: str
    style_title: str
    style_image_url: str
    comment_content: str
    comment_created_at: datetime
    style_author_id: str | None = None
    style_author_name: str
    style_author_avatar_url: str | None = None


class MyStyleCommentListResponse(BaseModel):
    items: list[MyStyleCommentItem]


class UserLocationUpdateRequest(BaseModel):
    city: str


class UserPrivacyRead(BaseModel):
    show_following_public: bool
    show_followers_public: bool
    show_comments_public: bool
    show_likes_public: bool


class UserPrivacyUpdateRequest(BaseModel):
    show_following_public: bool | None = None
    show_followers_public: bool | None = None
    show_comments_public: bool | None = None
    show_likes_public: bool | None = None


class UserSummaryRead(BaseModel):
    id: str
    uid: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    city: str
    is_following: bool = False


class UserListResponse(BaseModel):
    items: list[UserSummaryRead]


class AuthorProfileRead(BaseModel):
    id: str
    uid: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    city: str
    follower_count: int
    following_count: int
    published_count: int
    total_like_count: int
    is_following: bool
    is_mine: bool
    can_view_following: bool = True
    can_view_followers: bool = True
    can_view_comments: bool = True
    can_view_likes: bool = True
    has_blocked_viewer: bool = False
    viewer_has_blocked_author: bool = False
    posts: list[AuthorPostRead]
