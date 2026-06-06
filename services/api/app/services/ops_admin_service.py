from __future__ import annotations

import calendar
import json
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.booking import Booking
from app.models.direct_message import DirectMessage
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.ops_coupon_grant import OpsCouponGrant
from app.models.tryon_job import TryOnJob
from app.models.user import User
from app.models.user_favorite import UserFavorite
from app.models.user_hand_photo import UserHandPhoto
from app.models.user_post import UserPost
from app.models.user_style_like import UserStyleLike
from app.schemas.ops import (
    OpsCouponGrantCreate,
    OpsCouponGrantRead,
    OpsDashboardMetrics,
    OpsDashboardResponse,
    OpsMerchantListItem,
    OpsMerchantListResponse,
    OpsMerchantUserListItem,
    OpsMerchantUserListResponse,
    OpsMetricPair,
    OpsPostListItem,
    OpsPostListResponse,
    OpsPopularNail,
    OpsUserListItem,
    OpsUserListResponse,
)

class OpsAdminService:
    def _today_window(self) -> tuple[datetime, datetime, date, str]:
        settings = get_settings()
        tz_name = settings.ops_report_timezone
        local_today = datetime.now(ZoneInfo(tz_name)).date()
        local_start = datetime.combine(local_today, time.min, tzinfo=ZoneInfo(tz_name))
        local_end = datetime.combine(local_today, time.max, tzinfo=ZoneInfo(tz_name))
        return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc), local_today, tz_name

    def _count(self, db: Session, statement) -> int:
        return int(db.scalar(statement) or 0)

    def _today_count(self, db: Session, model, start: datetime, end: datetime, *criteria) -> int:
        return self._count(
            db,
            select(func.count(model.id)).where(model.created_at >= start, model.created_at <= end, *criteria),
        )

    def _metric(self, total: int, today: int) -> OpsMetricPair:
        return OpsMetricPair(total=total, today=today)

    def _revenue_yuan(self, db: Session, *criteria) -> int:
        amount_cents = int(db.scalar(select(func.coalesce(func.sum(Booking.amount_cents), 0)).where(*criteria)) or 0)
        return amount_cents // 100

    def dashboard(self, db: Session) -> OpsDashboardResponse:
        start, end, report_date, tz_name = self._today_window()

        user_total = self._count(db, select(func.count(User.id)).where(User.role == "consumer"))
        user_today = self._today_count(db, User, start, end, User.role == "consumer")

        merchant_total = self._count(db, select(func.count(MerchantShop.id)))
        merchant_today = self._today_count(db, MerchantShop, start, end)

        images_total = sum(
            [
                self._count(db, select(func.count(NailStyle.id))),
                self._count(db, select(func.count(UserPost.id))),
                self._count(db, select(func.count(UserHandPhoto.id))),
                self._count(db, select(func.count(TryOnJob.id)).where(TryOnJob.result_image_path.is_not(None))),
            ]
        )
        images_today = sum(
            [
                self._today_count(db, NailStyle, start, end),
                self._today_count(db, UserPost, start, end),
                self._today_count(db, UserHandPhoto, start, end),
                self._today_count(db, TryOnJob, start, end, TryOnJob.result_image_path.is_not(None)),
            ]
        )

        likes_total = self._count(db, select(func.count(UserStyleLike.id)))
        likes_today = self._today_count(db, UserStyleLike, start, end)
        collects_total = self._count(db, select(func.count(UserFavorite.id)))
        collects_today = self._today_count(db, UserFavorite, start, end)
        shares_total = self._count(db, select(func.count(DirectMessage.id)).where(DirectMessage.shared_style_id.is_not(None)))
        shares_today = self._today_count(db, DirectMessage, start, end, DirectMessage.shared_style_id.is_not(None))

        tryon_users_total = self._count(db, select(func.count(func.distinct(TryOnJob.user_id))))
        tryon_users_today = self._count(
            db,
            select(func.count(func.distinct(TryOnJob.user_id))).where(TryOnJob.created_at >= start, TryOnJob.created_at <= end),
        )

        bookings_total = self._count(db, select(func.count(Booking.id)))
        bookings_today = self._today_count(db, Booking, start, end)
        completed_total = self._count(db, select(func.count(Booking.id)).where(Booking.status == "completed"))
        completed_today = self._count(
            db,
            select(func.count(Booking.id)).where(
                Booking.status == "completed",
                Booking.updated_at >= start,
                Booking.updated_at <= end,
            ),
        )
        revenue_total = self._revenue_yuan(db, Booking.status == "completed")
        revenue_today = self._revenue_yuan(
            db,
            Booking.status == "completed",
            Booking.updated_at >= start,
            Booking.updated_at <= end,
        )

        metrics = OpsDashboardMetrics(
            users=self._metric(user_total, user_today),
            merchants=self._metric(merchant_total, merchant_today),
            images=self._metric(images_total, images_today),
            likes=self._metric(likes_total, likes_today),
            collects=self._metric(collects_total, collects_today),
            shares=self._metric(shares_total, shares_today),
            tryon_users=self._metric(tryon_users_total, tryon_users_today),
            bookings=self._metric(bookings_total, bookings_today),
            completed_bookings=self._metric(completed_total, completed_today),
            revenue=self._metric(revenue_total, revenue_today),
        )
        if self._should_use_demo_metrics(metrics):
            metrics = self._demo_dashboard_metrics()
        return OpsDashboardResponse(
            report_date=report_date,
            timezone=tz_name,
            metrics=metrics,
            popular_nails=self.popular_nails(report_date),
        )

    def _should_use_demo_metrics(self, metrics: OpsDashboardMetrics) -> bool:
        settings = get_settings()
        return bool(
            settings.ops_demo_metrics_enabled
            and metrics.users.total == 0
            and metrics.images.total == 0
            and metrics.bookings.total == 0
            and metrics.revenue.total == 0
        )

    def _demo_dashboard_metrics(self) -> OpsDashboardMetrics:
        return OpsDashboardMetrics(
            users=self._metric(1286, 96),
            merchants=self._metric(48, 5),
            images=self._metric(3920, 286),
            likes=self._metric(18420, 1388),
            collects=self._metric(7240, 531),
            shares=self._metric(2180, 167),
            tryon_users=self._metric(862, 74),
            bookings=self._metric(328, 31),
            completed_bookings=self._metric(246, 24),
            revenue=self._metric(59860, 6288),
        )

    def popular_nails(self, report_date: date) -> list[OpsPopularNail]:
        settings = get_settings()
        date_key = report_date.strftime("%Y%m%d")
        root = settings.xhs_crawler_assets_path
        digest_path = root / date_key / "xhs_note_digest.json"
        if not digest_path.exists():
            digest_path = next(
                (
                    path
                    for path in sorted(root.glob("[0-9]" * 8 + "/xhs_note_digest.json"), reverse=True)
                    if path.parent.name <= date_key
                ),
                None,
            )
        if digest_path is None:
            return []
        payload = json.loads(digest_path.read_text(encoding="utf-8"))
        return [OpsPopularNail(**item) for item in payload.get("notes", [])]

    def list_users(self, db: Session, query: str = "", limit: int = 10, offset: int = 0) -> OpsUserListResponse:
        statement = select(User).where(User.role == "consumer")
        count_statement = select(func.count(User.id)).where(User.role == "consumer")
        if query:
            pattern = f"%{query}%"
            filter_clause = or_(User.username.ilike(pattern), User.phone.ilike(pattern))
            statement = statement.where(filter_clause)
            count_statement = count_statement.where(filter_clause)
        total = self._count(db, count_statement)
        users = list(db.scalars(statement.order_by(User.created_at.desc()).offset(offset).limit(limit)))
        return OpsUserListResponse(items=[self._user_item(db, user) for user in users], total=total)

    def get_user(self, db: Session, user_id: str) -> OpsUserListItem:
        user = db.get(User, user_id)
        if user is None or user.role != "consumer":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
        return self._user_item(db, user)

    def _user_item(self, db: Session, user: User) -> OpsUserListItem:
        return OpsUserListItem(
            id=user.id,
            uid=user.uid,
            username=user.username,
            phone=user.phone,
            avatar_url=user.avatar_url,
            last_login_ip_location=user.last_login_ip_location,
            role=user.role,
            created_at=user.created_at,
            booking_count=self._count(db, select(func.count(Booking.id)).where(Booking.user_id == user.id)),
            tryon_count=self._count(db, select(func.count(TryOnJob.id)).where(TryOnJob.user_id == user.id)),
            like_count=self._count(db, select(func.count(UserStyleLike.id)).where(UserStyleLike.user_id == user.id)),
            collect_count=self._count(db, select(func.count(UserFavorite.id)).where(UserFavorite.user_id == user.id)),
        )

    def list_merchants(
        self,
        db: Session,
        query: str = "",
        city: str = "",
        limit: int = 10,
        offset: int = 0,
    ) -> OpsMerchantListResponse:
        statement = select(MerchantShop).join(User, MerchantShop.merchant_user_id == User.id)
        count_statement = select(func.count(MerchantShop.id)).join(User, MerchantShop.merchant_user_id == User.id)
        if city:
            statement = statement.where(MerchantShop.city == city)
            count_statement = count_statement.where(MerchantShop.city == city)
        if query:
            pattern = f"%{query}%"
            filter_clause = or_(
                MerchantShop.name.ilike(pattern),
                MerchantShop.city.ilike(pattern),
                MerchantShop.contact_phone.ilike(pattern),
                User.username.ilike(pattern),
                User.phone.ilike(pattern),
            )
            statement = statement.where(filter_clause)
            count_statement = count_statement.where(filter_clause)
        total = self._count(db, count_statement)
        shops = list(db.scalars(statement.order_by(MerchantShop.created_at.desc()).offset(offset).limit(limit)))
        return OpsMerchantListResponse(items=[self._merchant_item(db, shop) for shop in shops], total=total)

    def list_merchant_cities(self, db: Session) -> list[str]:
        cities = db.scalars(select(func.distinct(MerchantShop.city)).where(MerchantShop.city != "").order_by(MerchantShop.city))
        return [city for city in cities if city]

    def get_merchant(self, db: Session, shop_id: str) -> OpsMerchantListItem:
        shop = db.get(MerchantShop, shop_id)
        if shop is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商家不存在")
        return self._merchant_item(db, shop)

    def _merchant_item(self, db: Session, shop: MerchantShop) -> OpsMerchantListItem:
        merchant = shop.merchant
        return OpsMerchantListItem(
            id=shop.id,
            merchant_user_id=shop.merchant_user_id,
            merchant_uid=merchant.uid if merchant else 0,
            merchant_name=merchant.username if merchant else "商家",
            merchant_phone=merchant.phone if merchant else None,
            merchant_last_login_ip_location=merchant.last_login_ip_location if merchant else None,
            name=shop.name,
            city=shop.city,
            address=shop.address,
            contact_phone=shop.contact_phone,
            created_at=shop.created_at,
            booking_count=self._count(db, select(func.count(Booking.id)).where(Booking.shop_id == shop.id)),
            completed_booking_count=self._count(
                db,
                select(func.count(Booking.id)).where(Booking.shop_id == shop.id, Booking.status == "completed"),
            ),
        )

    def list_merchant_users(self, db: Session, query: str = "", limit: int = 50, offset: int = 0) -> OpsMerchantUserListResponse:
        statement = select(User).where(User.role == "merchant")
        count_statement = select(func.count(User.id)).where(User.role == "merchant")
        if query:
            pattern = f"%{query}%"
            filter_clause = or_(User.username.ilike(pattern), User.phone.ilike(pattern))
            statement = statement.where(filter_clause)
            count_statement = count_statement.where(filter_clause)
        total = self._count(db, count_statement)
        users = list(db.scalars(statement.order_by(User.created_at.desc()).offset(offset).limit(limit)))
        return OpsMerchantUserListResponse(items=[self._merchant_user_item(db, user) for user in users], total=total)

    def get_merchant_user(self, db: Session, user_id: str) -> OpsMerchantUserListItem:
        user = db.get(User, user_id)
        if user is None or user.role != "merchant":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商家用户不存在")
        return self._merchant_user_item(db, user)

    def _merchant_user_item(self, db: Session, user: User) -> OpsMerchantUserListItem:
        return OpsMerchantUserListItem(
            id=user.id,
            uid=user.uid,
            username=user.username,
            phone=user.phone,
            avatar_url=user.avatar_url,
            last_login_ip_location=user.last_login_ip_location,
            role=user.role,
            created_at=user.created_at,
            shop_count=self._count(db, select(func.count(MerchantShop.id)).where(MerchantShop.merchant_user_id == user.id)),
            booking_count=self._count(db, select(func.count(Booking.id)).where(Booking.merchant_user_id == user.id)),
            completed_booking_count=self._count(
                db,
                select(func.count(Booking.id)).where(Booking.merchant_user_id == user.id, Booking.status == "completed"),
            ),
        )

    def list_posts(self, db: Session, query: str = "", limit: int = 50, offset: int = 0) -> OpsPostListResponse:
        statement = select(UserPost).join(User, UserPost.user_id == User.id).outerjoin(MerchantShop, UserPost.shop_id == MerchantShop.id)
        count_statement = select(func.count(UserPost.id)).join(User, UserPost.user_id == User.id).outerjoin(
            MerchantShop,
            UserPost.shop_id == MerchantShop.id,
        )
        if query:
            pattern = f"%{query}%"
            filter_clause = or_(
                UserPost.title.ilike(pattern),
                UserPost.description.ilike(pattern),
                cast(UserPost.tags_json, String).ilike(pattern),
                User.username.ilike(pattern),
                User.phone.ilike(pattern),
                MerchantShop.name.ilike(pattern),
                MerchantShop.city.ilike(pattern),
            )
            statement = statement.where(filter_clause)
            count_statement = count_statement.where(filter_clause)

        total = self._count(db, count_statement)
        posts = list(db.scalars(statement.order_by(UserPost.created_at.desc()).offset(offset).limit(limit)))
        return OpsPostListResponse(items=[self._post_item(post) for post in posts], total=total)

    def get_post(self, db: Session, post_id: str) -> OpsPostListItem:
        post = db.get(UserPost, post_id)
        if post is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在")
        return self._post_item(post)

    def _post_item(self, post: UserPost) -> OpsPostListItem:
        user = post.user
        shop = post.shop
        return OpsPostListItem(
            id=post.id,
            author_user_id=post.user_id,
            author_uid=user.uid if user else 0,
            author_name=user.username if user else "未知用户",
            author_role=user.role if user else "",
            title=post.title,
            description=post.description,
            image_url=post.image_url,
            local_image_path=post.local_image_path,
            tags=post.tags_json or [],
            is_hidden=post.is_hidden,
            shop_id=post.shop_id,
            shop_name=shop.name if shop else None,
            shop_city=shop.city if shop else None,
            verified_booking_id=post.verified_booking_id,
            created_at=post.created_at,
            updated_at=post.updated_at,
        )

    def create_coupon(self, db: Session, payload: OpsCouponGrantCreate, created_by: str) -> OpsCouponGrantRead:
        self._target_name(db, payload.target_type, payload.target_id)
        grant = OpsCouponGrant(
            target_type=payload.target_type,
            target_id=payload.target_id,
            coupon_name=payload.coupon_name.strip(),
            amount=payload.amount,
            valid_from=None,
            valid_until=payload.expiry_date or self._default_coupon_expiry_date(),
            note=payload.note.strip(),
            created_by=created_by,
        )
        db.add(grant)
        db.commit()
        db.refresh(grant)
        return self._coupon_item(db, grant)

    def list_coupons(self, db: Session, limit: int = 50, offset: int = 0) -> dict[str, object]:
        total = self._count(db, select(func.count(OpsCouponGrant.id)))
        grants = list(db.scalars(select(OpsCouponGrant).order_by(OpsCouponGrant.created_at.desc()).offset(offset).limit(limit)))
        return {"items": [self._coupon_item(db, grant) for grant in grants], "total": total}

    def _coupon_item(self, db: Session, grant: OpsCouponGrant) -> OpsCouponGrantRead:
        return OpsCouponGrantRead(
            id=grant.id,
            target_type=grant.target_type,  # type: ignore[arg-type]
            target_id=grant.target_id,
            target_name=self._target_name(db, grant.target_type, grant.target_id),
            coupon_name=grant.coupon_name,
            amount=grant.amount,
            expiry_date=grant.valid_until,
            note=grant.note,
            created_by=grant.created_by,
            created_at=grant.created_at,
        )

    def _default_coupon_expiry_date(self) -> date:
        today = datetime.now(ZoneInfo(get_settings().ops_report_timezone)).date()
        month = today.month + 3
        year = today.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(today.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    def _target_name(self, db: Session, target_type: str, target_id: str) -> str:
        if target_type == "user":
            user = db.get(User, target_id)
            if user is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
            return user.username
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="优惠券目标类型不合法")
