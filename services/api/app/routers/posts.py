from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.booking import Booking
from app.models.merchant_shop import MerchantShop
from app.models.user import User
from app.routers.helpers import serialize_post
from app.schemas.events import StyleEventInput
from app.schemas.posts import UserPostListResponse, UserPostRead, UserPostUpdateRequest
from app.services.event_service import EventService
from app.services.merchant_service import MerchantShopService
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
    verified_booking_id: str | None = Form(default=None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPostRead:
    shop = None
    verified_booking = None
    if user.role == "merchant":
        if verified_booking_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="商家发布不能绑定消费订单")
        shop = shop_service.get_owned_shop(db, user, shop_id) if shop_id else shop_service.get_default_shop(db, user)
    else:
        if shop_id and not verified_booking_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="绑定门店需要选择已完成订单")
        if verified_booking_id:
            verified_booking = db.get(Booking, verified_booking_id)
            if verified_booking is None or verified_booking.user_id != user.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
            if verified_booking.status != "completed":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只有已完成订单才能绑定真实消费")
            if shop_id and shop_id != verified_booking.shop_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="选择的门店与订单不一致")
            shop = db.get(MerchantShop, verified_booking.shop_id)
            if shop is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单门店不存在")
    settings = get_settings()
    saved_path, _ = save_user_upload_file(image, user_upload_dir(settings.upload_path, "posts", user.uid), user.uid)
    tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    nail_type = "handmade" if user.role == "merchant" or verified_booking is not None else "press_on"
    post = post_service.create(
        db,
        user,
        title=title,
        description=description,
        image_url=public_url_for_path(saved_path),
        local_image_path=relative_to_base(saved_path),
        tags=tag_list,
        nail_type=nail_type,
        shop_id=shop.id if shop is not None else None,
        verified_booking_id=verified_booking.id if verified_booking is not None else None,
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
