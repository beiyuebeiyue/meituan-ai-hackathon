from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user, get_optional_current_user
from app.models.nail_style import NailStyle
from app.models.style_comment import StyleComment
from app.models.user_style_like import UserStyleLike
from app.models.user import User
from app.routers.helpers import serialize_style, serialize_style_comment, serialize_style_detail
from app.schemas.nails import (
    NailStyleDetailRead,
    NailStyleListResponse,
    StyleCommentCreateRequest,
    StyleCommentListResponse,
    StyleCommentRead,
)
from app.services.follow_service import FollowService
from app.services.style_comment_service import StyleCommentService
from app.services.style_service import StyleService


router = APIRouter(prefix="/nails", tags=["nails"])
style_service = StyleService()
style_comment_service = StyleCommentService()
follow_service = FollowService()


def build_style_payloads(db: Session, items: list, user: User | None) -> list[NailStyleDetailRead]:
    favorite_ids = style_service.get_favorite_ids(db, user.id) if user else set()
    like_ids = style_service.get_like_ids(db, user.id) if user else set()
    following_ids = follow_service.get_following_ids(db, user.id) if user else set()
    payloads: list[NailStyleDetailRead] = []
    for style in items:
        author = style_service.resolve_style_author_user(db, style)
        post = style_service.get_post_for_style(db, style) if user and author and author.id == user.id else None
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
                is_following_author=bool(user and author and author.id != user.id and author.id in following_ids),
                is_authored_by_me=bool(user and author and author.id == user.id),
                manage_post_id=post.id if post is not None else None,
                is_hidden=post.is_hidden if post is not None else False,
            )
        )
    return payloads


@router.get("/hot", response_model=NailStyleListResponse)
def list_hot(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    items, total = style_service.list_hot(db, page, page_size, viewer=user)
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=build_style_payloads(db, items, user),
    )


@router.get("/discover", response_model=NailStyleListResponse)
def list_discover(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    items, total = style_service.list_latest(db, page, page_size, viewer=user)
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=build_style_payloads(db, items, user),
    )


@router.get("/search", response_model=NailStyleListResponse)
def search_styles(
    query: str = Query(min_length=1, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    items, total = style_service.search_styles(db, query, page, page_size, viewer=user)
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=build_style_payloads(db, items, user),
    )


@router.get("/latest", response_model=NailStyleListResponse)
def list_latest(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    return list_discover(page=page, page_size=page_size, db=db, user=user)


@router.get("/following", response_model=NailStyleListResponse)
def list_following(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NailStyleListResponse:
    following_ids = follow_service.get_following_ids(db, user.id)
    items, total = style_service.list_following(db, user, following_ids, page, page_size)
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=build_style_payloads(db, items, user),
    )


@router.get("/local", response_model=NailStyleListResponse)
def list_local(
    city: str = Query(default="深圳", min_length=1, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    items, total = style_service.list_local(db, city, page, page_size, viewer=user)
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=build_style_payloads(db, items, user),
    )


@router.get("/likes/me", response_model=NailStyleListResponse)
def list_my_liked_styles(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NailStyleListResponse:
    like_rows = list(
        db.scalars(
            select(UserStyleLike)
            .where(UserStyleLike.user_id == user.id)
            .order_by(UserStyleLike.created_at.desc())
        )
    )
    items = [
        style
        for row in like_rows
        if (style := db.get(NailStyle, row.nail_style_id)) is not None
        and style_service.is_style_visible(db, style, user)
    ]
    return NailStyleListResponse(
        page=1,
        page_size=len(items),
        total=len(items),
        items=build_style_payloads(db, items, user),
    )


@router.get("/{style_id}", response_model=NailStyleDetailRead)
def get_style(
    style_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleDetailRead:
    style = style_service.get_style(db, style_id, viewer=user)
    return build_style_payloads(db, [style], user)[0]


@router.post("/{style_id}/views")
def record_style_view(
    style_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    style = style_service.get_style(db, style_id, viewer=user)
    style_service.record_view(db, style, user)
    return {"message": "已记录浏览"}


@router.get("/{style_id}/comments", response_model=StyleCommentListResponse)
def list_style_comments(
    style_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> StyleCommentListResponse:
    items = style_comment_service.list_for_style(db, style_id)
    return StyleCommentListResponse(
        items=[serialize_style_comment(item, is_mine=bool(user and item.user_id == user.id)) for item in items]
    )


@router.post("/{style_id}/likes")
def like_style(
    style_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    style_service.get_style(db, style_id, viewer=user)
    existing = db.scalar(
        select(UserStyleLike).where(
            UserStyleLike.user_id == user.id,
            UserStyleLike.nail_style_id == style_id,
        )
    )
    if existing is None:
        db.add(UserStyleLike(user_id=user.id, nail_style_id=style_id))
        db.commit()
    return {"message": "点赞成功"}


@router.delete("/{style_id}/likes")
def unlike_style(
    style_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    like = db.scalar(
        select(UserStyleLike).where(
            UserStyleLike.user_id == user.id,
            UserStyleLike.nail_style_id == style_id,
        )
    )
    if like is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="点赞不存在")
    db.delete(like)
    db.commit()
    return {"message": "已取消点赞"}


@router.post("/{style_id}/comments", response_model=StyleCommentRead)
def create_style_comment(
    style_id: str,
    payload: StyleCommentCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StyleCommentRead:
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="评论内容不能为空")
    comment = style_comment_service.create(db, user, style_id, content)
    return serialize_style_comment(comment, is_mine=True)


@router.delete("/{style_id}/comments/{comment_id}")
def delete_style_comment(
    style_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    style_comment_service.delete(db, user, style_id, comment_id)
    return {"message": "已删除评论"}
