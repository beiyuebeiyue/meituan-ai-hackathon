from __future__ import annotations

from pathlib import Path
import re

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.merchant_shop import MerchantShop
from app.models.style_comment import StyleComment
from app.models.user_favorite import UserFavorite
from app.models.user_style_like import UserStyleLike
from app.models.user_style_view import UserStyleView
from app.models.user_post import UserPost
from app.models.user import User
from app.services.block_service import BlockService
from app.services.xhs_style_materialization_service import XhsStyleMaterializationService
from app.utils.files import public_url_for_path, relative_to_base


class StyleService:
    def __init__(self) -> None:
        self.block_service = BlockService()
        self.xhs_materialization_service = XhsStyleMaterializationService()

    def ensure_xhs_styles(self, db: Session, include_xhs_posts: bool) -> None:
        if include_xhs_posts and not db.scalar(select(NailStyle.id).where(NailStyle.source_type == "xhs_note").limit(1)):
            self.xhs_materialization_service.ensure_top_styles(db)

    def list_hot(
        self,
        db: Session,
        page: int,
        page_size: int,
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> tuple[list[NailStyle], int]:
        self.ensure_xhs_styles(db, include_xhs_posts)
        statement = self._visible_list_statement(include_xhs_posts).order_by(
            NailStyle.is_trending.desc(),
            NailStyle.popularity_score.desc(),
            NailStyle.created_at.desc(),
        )
        matched = self.filter_visible_styles(db, list(db.scalars(statement)), viewer, include_xhs_posts=include_xhs_posts)
        total = len(matched)
        offset = (page - 1) * page_size
        items = matched[offset : offset + page_size]
        return items, total

    def list_latest(
        self,
        db: Session,
        page: int,
        page_size: int,
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> tuple[list[NailStyle], int]:
        self.ensure_xhs_styles(db, include_xhs_posts)
        statement = self._visible_list_statement(include_xhs_posts).order_by(NailStyle.created_at.desc())
        matched = self.filter_visible_styles(db, list(db.scalars(statement)), viewer, include_xhs_posts=include_xhs_posts)
        total = len(matched)
        offset = (page - 1) * page_size
        items = matched[offset : offset + page_size]
        return items, total

    def list_following(
        self,
        db: Session,
        user: User,
        following_ids: set[str],
        page: int,
        page_size: int,
        include_xhs_posts: bool = True,
    ) -> tuple[list[NailStyle], int]:
        self.ensure_xhs_styles(db, include_xhs_posts)
        ordered_styles = list(db.scalars(select(NailStyle).order_by(NailStyle.created_at.desc())))
        matched: list[NailStyle] = []
        for style in ordered_styles:
            if not self.is_style_visible(db, style, user, include_xhs_posts=include_xhs_posts):
                continue
            author = self.resolve_style_author_user(db, style)
            if author is None:
                continue
            if author.id == user.id:
                continue
            if author.id in following_ids:
                matched.append(style)
        total = len(matched)
        offset = (page - 1) * page_size
        return matched[offset : offset + page_size], total

    def list_local(
        self,
        db: Session,
        city: str,
        page: int,
        page_size: int,
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> tuple[list[NailStyle], int]:
        self.ensure_xhs_styles(db, include_xhs_posts)
        normalized_city = city.strip().replace("市", "") or "深圳"
        ordered_styles = list(db.scalars(select(NailStyle).order_by(NailStyle.created_at.desc())))
        matched = []
        for style in ordered_styles:
            if not self.is_style_visible(db, style, viewer, include_xhs_posts=include_xhs_posts):
                continue
            shop_city = style.shop.city if style.shop is not None else None
            if shop_city and normalized_city in shop_city.replace("市", ""):
                matched.append(style)
        total = len(matched)
        offset = (page - 1) * page_size
        return matched[offset : offset + page_size], total

    def list_by_shop(
        self,
        db: Session,
        shop_id: str,
        page: int,
        page_size: int,
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> tuple[list[NailStyle], int]:
        self.ensure_xhs_styles(db, include_xhs_posts)
        statement = (
            self._visible_list_statement(include_xhs_posts)
            .where(NailStyle.shop_id == shop_id)
            .order_by(NailStyle.is_trending.desc(), NailStyle.popularity_score.desc(), NailStyle.created_at.desc())
        )
        matched = self.filter_visible_styles(db, list(db.scalars(statement)), viewer, include_xhs_posts=include_xhs_posts)
        total = len(matched)
        offset = (page - 1) * page_size
        items = matched[offset : offset + page_size]
        return items, total

    def _visible_list_statement(self, include_xhs_posts: bool):
        statement = select(NailStyle)
        if not include_xhs_posts:
            statement = statement.where(NailStyle.source_type != "xhs_note")
        return statement

    def search_styles(
        self,
        db: Session,
        query_text: str,
        page: int,
        page_size: int,
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> tuple[list[NailStyle], int]:
        self.ensure_xhs_styles(db, include_xhs_posts)
        normalized_query = query_text.strip().lower().replace("＃", "#")
        tokens = [token for token in re.split(r"[\s#]+", normalized_query) if token]
        if not tokens:
            return self.list_latest(db, page, page_size, viewer=viewer, include_xhs_posts=include_xhs_posts)

        ordered_styles = self.filter_visible_styles(
            db,
            list(
                db.scalars(
                    select(NailStyle).order_by(
                        NailStyle.is_trending.desc(),
                        NailStyle.popularity_score.desc(),
                        NailStyle.created_at.desc(),
                    )
                )
            ),
            viewer,
            include_xhs_posts=include_xhs_posts,
        )

        scored: list[tuple[float, NailStyle]] = []
        for style in ordered_styles:
            title = (style.title or "").lower()
            description = (style.description or "").lower()
            tags = [str(tag).lower() for tag in (style.tags_json or [])]

            token_score = 0.0
            matched_all = True
            for token in tokens:
                token_matched = False
                if token in title:
                    token_score += 5.0
                    token_matched = True
                if token in description:
                    token_score += 3.0
                    token_matched = True
                if any(token in tag for tag in tags):
                    token_score += 4.0
                    token_matched = True
                if any(tag == token for tag in tags):
                    token_score += 1.0
                if not token_matched:
                    matched_all = False
                    break

            if matched_all:
                scored.append((token_score + style.popularity_score * 0.01, style))

        scored.sort(key=lambda item: (item[0], item[1].is_trending, item[1].popularity_score, item[1].created_at), reverse=True)
        total = len(scored)
        offset = (page - 1) * page_size
        items = [style for _, style in scored[offset : offset + page_size]]
        return items, total

    def get_style(self, db: Session, style_id: str, viewer: User | None = None) -> NailStyle:
        style = db.get(NailStyle, style_id)
        if style is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="款式不存在")
        if not self.is_style_visible(db, style, viewer):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="款式不存在")
        return style

    def get_favorite_ids(self, db: Session, user_id: str) -> set[str]:
        statement = select(UserFavorite.nail_style_id).where(UserFavorite.user_id == user_id)
        return set(db.scalars(statement))

    def get_like_ids(self, db: Session, user_id: str) -> set[str]:
        statement = select(UserStyleLike.nail_style_id).where(UserStyleLike.user_id == user_id)
        return set(db.scalars(statement))

    def get_like_count(self, db: Session, style_id: str) -> int:
        return db.scalar(select(func.count()).select_from(UserStyleLike).where(UserStyleLike.nail_style_id == style_id)) or 0

    def get_favorite_count(self, db: Session, style_id: str) -> int:
        return db.scalar(select(func.count()).select_from(UserFavorite).where(UserFavorite.nail_style_id == style_id)) or 0

    def get_comment_count(self, db: Session, style_id: str) -> int:
        return db.scalar(select(func.count()).select_from(StyleComment).where(StyleComment.nail_style_id == style_id)) or 0

    def record_view(self, db: Session, style: NailStyle, viewer: User) -> bool:
        db.add(UserStyleView(user_id=viewer.id, nail_style_id=style.id))
        db.commit()
        return True

    def get_view_count(self, db: Session, style_id: str) -> int:
        return db.scalar(select(func.count()).select_from(UserStyleView).where(UserStyleView.nail_style_id == style_id)) or 0

    def get_unique_viewer_count(self, db: Session, style_id: str) -> int:
        return (
            db.scalar(
                select(func.count(func.distinct(UserStyleView.user_id))).where(UserStyleView.nail_style_id == style_id)
            )
            or 0
        )

    def get_view_stats_map(self, db: Session, style_ids: list[str]) -> dict[str, dict[str, int]]:
        if not style_ids:
            return {}
        rows = db.execute(
            select(
                UserStyleView.nail_style_id,
                func.count(UserStyleView.id).label("view_count"),
                func.count(func.distinct(UserStyleView.user_id)).label("unique_viewer_count"),
            )
            .where(UserStyleView.nail_style_id.in_(style_ids))
            .group_by(UserStyleView.nail_style_id)
        ).all()
        return {
            row.nail_style_id: {
                "view_count": int(row.view_count or 0),
                "unique_viewer_count": int(row.unique_viewer_count or 0),
            }
            for row in rows
        }

    def resolve_style_author_user(self, db: Session, style: NailStyle) -> User | None:
        author_id = style.style_metadata_json.get("author_user_id") if isinstance(style.style_metadata_json, dict) else None
        if isinstance(author_id, str):
            author = db.get(User, author_id)
            if author is not None:
                return author
        if style.shop is not None and style.shop.merchant is not None:
            return style.shop.merchant
        settings = get_settings()
        return db.scalar(select(User).where(User.phone == settings.default_admin_phone))

    def resolve_style_author(self, db: Session, style: NailStyle) -> tuple[str, str | None]:
        author = self.resolve_style_author_user(db, style)
        if author is not None:
            return author.username, author.avatar_url
        return "焕甲图库", None

    def _author_style_conditions(self, author: User):
        author_user_id = NailStyle.style_metadata_json["author_user_id"].as_string()
        conditions = [author_user_id == author.id]
        if author.role == "merchant":
            merchant_shop_ids = select(MerchantShop.id).where(MerchantShop.merchant_user_id == author.id)
            conditions.append(NailStyle.shop_id.in_(merchant_shop_ids))

        settings = get_settings()
        if author.phone == settings.default_admin_phone:
            conditions.append(
                (author_user_id.is_(None) | (author_user_id == ""))
                & NailStyle.shop_id.is_(None)
            )
        return conditions

    def count_styles_for_author(self, db: Session, author: User) -> int:
        conditions = self._author_style_conditions(author)
        return (
            db.scalar(
                select(func.count())
                .select_from(NailStyle)
                .where(or_(*conditions))
            )
            or 0
        )

    def list_styles_for_author(
        self,
        db: Session,
        author: User,
        viewer: User | None = None,
        limit: int = 60,
    ) -> list[NailStyle]:
        conditions = self._author_style_conditions(author)
        styles = list(
            db.scalars(
                select(NailStyle)
                .where(or_(*conditions))
                .order_by(NailStyle.created_at.desc())
                .limit(limit)
            )
        )
        return self.filter_visible_styles(db, styles, viewer)

    def get_post_for_style(self, db: Session, style: NailStyle) -> UserPost | None:
        post_id = style.style_metadata_json.get("from_post_id") if isinstance(style.style_metadata_json, dict) else None
        if isinstance(post_id, str):
            return db.get(UserPost, post_id)
        return None

    def is_style_visible(
        self,
        db: Session,
        style: NailStyle,
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> bool:
        if not include_xhs_posts and style.source_type == "xhs_note":
            return False
        author = self.resolve_style_author_user(db, style)
        if viewer is not None and author is not None:
            if self.block_service.has_blocked(db, author.id, viewer.id):
                return False
            if self.block_service.has_blocked(db, viewer.id, author.id):
                return False
        post = self.get_post_for_style(db, style)
        if post is None or not post.is_hidden:
            return True
        return bool(viewer and viewer.id == post.user_id)

    def filter_visible_styles(
        self,
        db: Session,
        styles: list[NailStyle],
        viewer: User | None = None,
        include_xhs_posts: bool = True,
    ) -> list[NailStyle]:
        return [style for style in styles if self.is_style_visible(db, style, viewer, include_xhs_posts=include_xhs_posts)]

    def get_styles_for_post(self, db: Session, post_id: str) -> list[NailStyle]:
        styles = list(db.scalars(select(NailStyle)))
        return [
            style
            for style in styles
            if isinstance(style.style_metadata_json, dict) and style.style_metadata_json.get("from_post_id") == post_id
        ]

    def sync_styles_from_post(self, db: Session, post: UserPost) -> None:
        linked_styles = self.get_styles_for_post(db, post.id)
        for style in linked_styles:
            style.title = post.title
            style.description = post.description
            style.tags_json = post.tags_json or []
            style.image_url = post.image_url
            style.local_image_path = post.local_image_path
            style.nail_type = post.nail_type
            style.source_type = post.source_type
            style.shop_id = post.shop_id
            style.verified_booking_id = post.verified_booking_id
            metadata = style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
            metadata.update(post.source_metadata_json or {})
            metadata["author_user_id"] = post.user_id
            metadata["from_post_id"] = post.id
            style.style_metadata_json = metadata
            db.add(style)

    def create_style_from_post(self, db: Session, user: User, post: UserPost) -> NailStyle:
        style = NailStyle(
            title=post.title,
            shop_id=post.shop_id,
            verified_booking_id=post.verified_booking_id,
            description=post.description,
            image_url=post.image_url,
            local_image_path=post.local_image_path,
            nail_type=post.nail_type,
            source_type=post.source_type,
            tags_json=post.tags_json,
            dominant_colors_json=[],
            style_metadata_json={"author_user_id": user.id, "from_post_id": post.id, **(post.source_metadata_json or {})},
            popularity_score=0.0,
            is_trending=False,
        )
        db.add(style)
        db.commit()
        db.refresh(style)
        return style

    def style_image_path(self, style: NailStyle) -> Path:
        return Path(style.local_image_path)
