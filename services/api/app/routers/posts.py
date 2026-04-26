from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.routers.helpers import serialize_post
from app.schemas.events import StyleEventInput
from app.schemas.posts import UserPostListResponse, UserPostRead, UserPostUpdateRequest
from app.services.event_service import EventService
from app.services.merchant_service import MerchantShopService, require_merchant
from app.services.post_service import PostService
from app.services.style_service import StyleService
from app.utils.files import public_url_for_path, relative_to_base, save_user_upload_file, user_upload_dir


router = APIRouter(prefix="/posts", tags=["posts"])
style_service = StyleService()
event_service = EventService()
post_service = PostService()
shop_service = MerchantShopService()


@router.post("", response_model=UserPostRead)
def create_post(
    title: str = Form(...),
    description: str = Form(default=""),
    tags: str = Form(default=""),
    shop_id: str | None = Form(default=None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPostRead:
    require_merchant(user)
    shop = shop_service.get_owned_shop(db, user, shop_id) if shop_id else shop_service.get_default_shop(db, user)
    settings = get_settings()
    saved_path, _ = save_user_upload_file(image, user_upload_dir(settings.upload_path, "posts", user.uid), user.uid)
    tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    post = post_service.create(
        db,
        user,
        title=title,
        description=description,
        image_url=public_url_for_path(saved_path),
        local_image_path=relative_to_base(saved_path),
        tags=tag_list,
        shop_id=shop.id,
    )
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
    posts = post_service.list_for_user(db, user)
    return UserPostListResponse(items=[serialize_post(post) for post in posts])


@router.patch("/{post_id}", response_model=UserPostRead)
def update_my_post(
    post_id: str,
    payload: UserPostUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPostRead:
    if payload.title is not None and not payload.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标题不能为空")
    post = post_service.update_owned_post(
        db,
        user,
        post_id,
        title=payload.title,
        description=payload.description,
        tags=payload.tags,
        is_hidden=payload.is_hidden,
    )
    return serialize_post(post)


@router.delete("/{post_id}")
def delete_my_post(
    post_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    post_service.delete_owned_post(db, user, post_id)
    return {"message": "已删除发布内容"}
