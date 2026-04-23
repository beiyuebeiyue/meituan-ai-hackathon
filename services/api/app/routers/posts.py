from sqlalchemy import select
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_post import UserPost
from app.routers.helpers import serialize_post
from app.schemas.events import StyleEventInput
from app.schemas.posts import UserPostListResponse, UserPostRead
from app.services.event_service import EventService
from app.services.style_service import StyleService
from app.utils.files import public_url_for_path, relative_to_base, save_upload_file


router = APIRouter(prefix="/posts", tags=["posts"])
style_service = StyleService()
event_service = EventService()


@router.post("", response_model=UserPostRead)
def create_post(
    title: str = Form(...),
    description: str = Form(default=""),
    tags: str = Form(default=""),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPostRead:
    settings = get_settings()
    saved_path = save_upload_file(image, settings.upload_path / "posts", prefix="post")
    tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    post = UserPost(
        user_id=user.id,
        title=title,
        description=description,
        image_url=public_url_for_path(saved_path),
        local_image_path=relative_to_base(saved_path),
        tags_json=tag_list,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    style = style_service.create_style_from_post(db, user, post)
    event_service.record_style_events(
        db,
        [StyleEventInput(style_id=style.id, event_type="publish", source="post_feed", count=1)],
    )
    return serialize_post(post)


@router.get("/me", response_model=UserPostListResponse)
def list_my_posts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPostListResponse:
    posts = list(db.scalars(select(UserPost).where(UserPost.user_id == user.id).order_by(UserPost.created_at.desc())))
    return UserPostListResponse(items=[serialize_post(post) for post in posts])
