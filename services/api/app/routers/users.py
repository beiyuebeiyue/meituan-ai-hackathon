from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user, get_optional_current_user
from app.models.nail_style import NailStyle
from app.models.merchant_shop import MerchantShop
from app.models.user import User
from app.models.user_follow import UserFollow
from app.models.user_style_like import UserStyleLike
from app.routers.helpers import serialize_author_post, serialize_style, serialize_style_detail
from app.schemas.nails import NailStyleListResponse
from app.schemas.users import (
    AuthorProfileRead,
    MyStyleCommentItem,
    MyStyleCommentListResponse,
    UserBrowseHistoryBatchDeleteRequest,
    UserBrowseHistoryBatchDeleteResponse,
    UserBrowseHistoryListResponse,
    UserBrowseHistoryRead,
    UserHandPhotoListResponse,
    UserHandPhotoRead,
    UserListResponse,
    UserPrivacyRead,
    UserPrivacyUpdateRequest,
    UserRead,
    UserSummaryRead,
    serialize_user_read,
)
from app.services.browse_history_service import BrowseHistoryService
from app.services.block_service import BlockService
from app.services.follow_service import FollowService
from app.services.style_comment_service import StyleCommentService
from app.services.style_service import StyleService
from app.services.user_hand_photo_service import UserHandPhotoService
from app.services.image_processing_artifact_service import ImageProcessingArtifactService
from app.utils.files import public_url_for_path, save_user_upload_file, user_upload_dir
from app.core.config import get_settings


router = APIRouter(prefix="/users", tags=["users"])
hand_photo_service = UserHandPhotoService()
image_artifact_service = ImageProcessingArtifactService()
browse_history_service = BrowseHistoryService()
block_service = BlockService()
follow_service = FollowService()
style_service = StyleService()
style_comment_service = StyleCommentService()


def can_view_private_section(author: User, viewer: User | None) -> bool:
    return bool(viewer is not None and viewer.id == author.id)


def ensure_section_visible(author: User, viewer: User | None, detail: str) -> None:
    if not can_view_private_section(author, viewer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def serialize_user_summary(db: Session, target: User, viewer: User | None) -> UserSummaryRead:
    return UserSummaryRead(
        id=target.id,
        uid=target.uid,
        username=target.username,
        avatar_url=target.avatar_url,
        bio=target.bio,
        ip_location=target.last_login_ip_location or "未知",
        is_shop=target.role == "merchant",
        is_following=bool(viewer and viewer.id != target.id and follow_service.is_following(db, viewer.id, target.id)),
    )


def build_style_payloads_for_viewer(db: Session, items: list, viewer: User | None) -> list:
    favorite_ids = style_service.get_favorite_ids(db, viewer.id) if viewer else set()
    like_ids = style_service.get_like_ids(db, viewer.id) if viewer else set()
    following_ids = follow_service.get_following_ids(db, viewer.id) if viewer else set()
    payloads = []
    for style in items:
        author = style_service.resolve_style_author_user(db, style)
        payloads.append(
            serialize_style_detail(
                style,
                favorite_ids=favorite_ids,
                like_ids=like_ids,
                like_count=style_service.get_like_count(db, style.id),
                favorite_count=style_service.get_favorite_count(db, style.id),
                comment_count=style_service.get_comment_count(db, style.id),
                author_id=author.id if author else None,
                author_name=author.username if author else "焕甲图库",
                author_avatar_url=author.avatar_url if author else None,
                author_is_shop=bool(author and author.role == "merchant"),
                is_following_author=bool(viewer and author and author.id != viewer.id and author.id in following_ids),
                is_authored_by_me=bool(viewer and author and author.id == viewer.id),
            )
        )
    return payloads


@router.get("/me", response_model=UserRead)
def get_me(user: User = Depends(get_current_user)) -> UserRead:
    return serialize_user_read(user)


@router.get("/me/hand-photos", response_model=UserHandPhotoListResponse)
def get_my_hand_photos(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserHandPhotoListResponse:
    items = []
    for item in hand_photo_service.list_for_user(db, user):
        artifact = image_artifact_service.get_existing_for_hash(db, item.sha256, "user_hand")
        items.append(
            UserHandPhotoRead(
                id=item.id,
                image_url=item.image_url,
                processing_status=artifact.status if artifact is not None else None,
                created_at=item.created_at,
            )
        )
    return UserHandPhotoListResponse(items=items)


@router.post("/me/hand-photos", response_model=UserHandPhotoRead)
def upload_my_hand_photo(
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserHandPhotoRead:
    item = hand_photo_service.save_uploaded(db, user, image)
    artifact = image_artifact_service.get_existing_for_hash(db, item.sha256, "user_hand")
    return UserHandPhotoRead(
        id=item.id,
        image_url=item.image_url,
        processing_status=artifact.status if artifact is not None else None,
        created_at=item.created_at,
    )


@router.delete("/me/hand-photos/{hand_photo_id}")
def delete_my_hand_photo(
    hand_photo_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    hand_photo_service.delete_for_user(db, user, hand_photo_id)
    return {"message": "已删除手图"}


@router.post("/me/browse-history")
def record_my_browse_history(
    style_id: str = Form(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    browse_history_service.record(db, user, style_id)
    return {"message": "已记录浏览历史"}


@router.get("/me/browse-history", response_model=UserBrowseHistoryListResponse)
def get_my_browse_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserBrowseHistoryListResponse:
    items = [
        UserBrowseHistoryRead(
            id=item.id,
            style=serialize_style(item.style),
            viewed_at=item.updated_at,
        )
        for item in browse_history_service.list_for_user(db, user)
        if item.style is not None
    ]
    return UserBrowseHistoryListResponse(items=items)


@router.delete("/me/browse-history/{history_id}")
def delete_my_browse_history(
    history_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    browse_history_service.delete(db, user, history_id)
    return {"message": "已删除浏览记录"}


@router.post("/me/browse-history/batch-delete", response_model=UserBrowseHistoryBatchDeleteResponse)
def batch_delete_my_browse_history(
    payload: UserBrowseHistoryBatchDeleteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserBrowseHistoryBatchDeleteResponse:
    deleted_count = browse_history_service.delete_many(db, user, payload.history_ids)
    return UserBrowseHistoryBatchDeleteResponse(deleted_count=deleted_count)


@router.put("/me", response_model=UserRead)
def update_me(
    username: str | None = Form(default=None),
    birthday: str | None = Form(default=None),
    bio: str | None = Form(default=None),
    clear_bio: bool = Form(default=False),
    avatar_file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserRead:
    settings = get_settings()
    if username is not None:
        user.username = username
    if birthday is not None:
        user.birthday = birthday
    if clear_bio:
        user.bio = ""
    elif bio is not None:
        normalized_bio = bio.strip()
        if len(normalized_bio) > 128:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="个人简介不能超过128个字符")
        user.bio = normalized_bio
    if avatar_file:
        saved_path, _ = save_user_upload_file(avatar_file, user_upload_dir(settings.upload_path, "avatars", user.uid), user.uid)
        user.avatar_url = public_url_for_path(saved_path)
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user_read(user)


@router.get("/me/privacy", response_model=UserPrivacyRead)
def get_my_privacy(user: User = Depends(get_current_user)) -> UserPrivacyRead:
    return UserPrivacyRead(
        show_following_public=False,
        show_followers_public=False,
        show_comments_public=False,
        show_likes_public=False,
    )


@router.patch("/me/privacy", response_model=UserPrivacyRead)
def update_my_privacy(
    _payload: UserPrivacyUpdateRequest,
    user: User = Depends(get_current_user),
) -> UserPrivacyRead:
    return get_my_privacy(user)


@router.get("/me/blocks", response_model=UserListResponse)
def get_my_blocked_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserListResponse:
    items = [serialize_user_summary(db, item, user) for item in block_service.list_blocked_users(db, user.id)]
    return UserListResponse(items=items)


@router.get("/me/style-comments", response_model=MyStyleCommentListResponse)
def get_my_style_comments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MyStyleCommentListResponse:
    items = []
    for comment in style_comment_service.list_for_user(db, user):
        style = comment.style
        if style is None or not style_service.is_style_visible(db, style, user):
            continue
        author = style_service.resolve_style_author_user(db, style)
        items.append(
            MyStyleCommentItem(
                comment_id=comment.id,
                style_id=style.id,
                style_title=style.title,
                style_image_url=style.image_url,
                comment_content=comment.content,
                comment_created_at=comment.created_at,
                style_author_id=author.id if author else None,
                style_author_name=author.username if author else "焕甲图库",
                style_author_avatar_url=author.avatar_url if author else None,
            )
        )
    return MyStyleCommentListResponse(items=items)


@router.get("/search", response_model=UserListResponse)
def search_users(
    query: str = Query(min_length=1, max_length=80),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> UserListResponse:
    keyword = query.strip()
    if not keyword:
        return UserListResponse(items=[])

    pattern = f"%{keyword}%"
    conditions = [
        User.username.ilike(pattern),
        User.bio.ilike(pattern),
        User.last_login_ip_location.ilike(pattern),
    ]
    if keyword.isdigit():
        conditions.append(cast(User.uid, String).ilike(f"{keyword}%"))

    candidates = list(
        db.scalars(
            select(User)
            .where(or_(*conditions))
            .order_by(User.uid.asc())
            .limit(limit)
        )
    )
    visible_users = []
    for item in candidates:
        has_blocked_viewer, viewer_has_blocked_item = block_service.get_relationship(db, user.id if user else None, item.id)
        if has_blocked_viewer or viewer_has_blocked_item:
            continue
        visible_users.append(serialize_user_summary(db, item, user))
    return UserListResponse(items=visible_users)


@router.get("/{author_id}/following", response_model=UserListResponse)
def get_author_following(
    author_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> UserListResponse:
    author = db.get(User, author_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作者不存在")
    items = [serialize_user_summary(db, item, user) for item in follow_service.list_following(db, author.id)]
    return UserListResponse(items=items)


@router.get("/{author_id}/followers", response_model=UserListResponse)
def get_author_followers(
    author_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> UserListResponse:
    author = db.get(User, author_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作者不存在")
    items = [serialize_user_summary(db, item, user) for item in follow_service.list_followers(db, author.id)]
    return UserListResponse(items=items)


@router.get("/{author_id}/style-comments", response_model=MyStyleCommentListResponse)
def get_author_style_comments(
    author_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> MyStyleCommentListResponse:
    author = db.get(User, author_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作者不存在")
    ensure_section_visible(author, user, "该用户已设置评论不可见")
    items = []
    for comment in style_comment_service.list_for_user(db, author):
        style = comment.style
        if style is None or not style_service.is_style_visible(db, style, user):
            continue
        style_author = style_service.resolve_style_author_user(db, style)
        items.append(
            MyStyleCommentItem(
                comment_id=comment.id,
                style_id=style.id,
                style_title=style.title,
                style_image_url=style.image_url,
                comment_content=comment.content,
                comment_created_at=comment.created_at,
                style_author_id=style_author.id if style_author else None,
                style_author_name=style_author.username if style_author else "焕甲图库",
                style_author_avatar_url=style_author.avatar_url if style_author else None,
            )
        )
    return MyStyleCommentListResponse(items=items)


@router.get("/{author_id}/liked-styles", response_model=NailStyleListResponse)
def get_author_liked_styles(
    author_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    author = db.get(User, author_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作者不存在")
    ensure_section_visible(author, user, "该用户已设置点赞不可见")
    like_rows = list(
        db.scalars(
            select(UserStyleLike)
            .where(UserStyleLike.user_id == author.id)
            .order_by(UserStyleLike.created_at.desc())
        )
    )
    items = [
        style
        for row in like_rows
        if (style := db.get(NailStyle, row.nail_style_id)) is not None
    ]
    visible_items = [style for style in items if style_service.is_style_visible(db, style, user)]
    return NailStyleListResponse(
        page=1,
        page_size=len(visible_items),
        total=len(visible_items),
        items=build_style_payloads_for_viewer(db, visible_items, user),
    )


@router.get("/{author_id}/author-profile", response_model=AuthorProfileRead)
def get_author_profile(
    author_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> AuthorProfileRead:
    author = db.get(User, author_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作者不存在")

    styles = style_service.list_styles_for_author(db, author, user)
    is_mine = bool(user and user.id == author.id)
    like_ids = style_service.get_like_ids(db, user.id) if user else set()
    view_stats = style_service.get_view_stats_map(db, [style.id for style in styles]) if is_mine else {}
    authored_posts = [
        serialize_author_post(
            style,
            style_service.get_post_for_style(db, style),
            is_liked=style.id in like_ids,
            like_count=style_service.get_like_count(db, style.id),
            view_count=view_stats.get(style.id, {}).get("view_count", 0),
            unique_viewer_count=view_stats.get(style.id, {}).get("unique_viewer_count", 0),
        )
        for style in styles
    ]
    total_like_count = sum(style_service.get_like_count(db, style.id) for style in styles)
    follower_count = db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.followed_user_id == author.id)) or 0
    following_count = db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.follower_user_id == author.id)) or 0
    has_blocked_viewer, viewer_has_blocked_author = block_service.get_relationship(db, user.id if user else None, author.id)
    default_shop = None
    if author.role == "merchant":
        default_shop = db.scalar(
            select(MerchantShop)
            .where(MerchantShop.merchant_user_id == author.id)
            .order_by(MerchantShop.is_default.desc(), MerchantShop.created_at.asc())
        )

    return AuthorProfileRead(
        id=author.id,
        uid=author.uid,
        role=author.role,
        is_shop=author.role == "merchant",
        username=author.username,
        avatar_url=author.avatar_url,
        bio=author.bio,
        ip_location=author.last_login_ip_location or "未知",
        follower_count=follower_count,
        following_count=following_count,
        published_count=len(styles),
        total_like_count=total_like_count,
        is_following=bool(user and user.id != author.id and follow_service.is_following(db, user.id, author.id)),
        is_mine=is_mine,
        can_view_following=True,
        can_view_followers=True,
        can_view_comments=can_view_private_section(author, user),
        can_view_likes=can_view_private_section(author, user),
        has_blocked_viewer=has_blocked_viewer,
        viewer_has_blocked_author=viewer_has_blocked_author,
        shop_id=default_shop.id if default_shop else None,
        shop_name=default_shop.name if default_shop else None,
        shop_city=default_shop.city if default_shop else None,
        shop_address=default_shop.address if default_shop else None,
        posts=authored_posts,
    )


@router.post("/{target_user_id}/follow")
def follow_user(
    target_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    target = follow_service.follow(db, user, target_user_id)
    return {"message": f"已关注 {target.username}"}


@router.delete("/{target_user_id}/follow")
def unfollow_user(
    target_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    follow_service.unfollow(db, user, target_user_id)
    return {"message": "已取消关注"}


@router.post("/{target_user_id}/block")
def block_user(
    target_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    target = block_service.block(db, user, target_user_id)
    return {"message": f"已设置不再看 {target.username}"}


@router.delete("/{target_user_id}/block")
def unblock_user(
    target_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    block_service.unblock(db, user, target_user_id)
    return {"message": "已恢复查看"}
