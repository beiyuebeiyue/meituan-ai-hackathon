from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, time, timezone
from hashlib import sha1
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.analytics_event import AnalyticsEvent, AnalyticsIdentityLink
from app.models.booking import Booking
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.user import User
from app.schemas.events import AnalyticsEventInput
from app.schemas.ops import (
    OpsAnalyticsFunnelStep,
    OpsAnalyticsOverviewResponse,
    OpsAnalyticsKpis,
    OpsAnalyticsRankItem,
    OpsAnalyticsTrendPoint,
)


FUNNEL_STEPS = [
    ("ai_recommendation_shown", "推荐曝光"),
    ("ai_recommendation_click", "推荐点击"),
    ("tryon_started", "开始试戴"),
    ("tryon_completed", "完成试戴"),
    ("booking_start_clicked", "发起预约"),
    ("booking_submit_clicked", "提交预约"),
    ("booking_completed", "完成订单"),
]


class AnalyticsService:
    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _local_window(self, start_date: date | None, end_date: date | None) -> tuple[datetime, datetime, date, date]:
        tz = ZoneInfo(get_settings().ops_report_timezone)
        today = datetime.now(tz).date()
        start_day = start_date or today
        end_day = end_date or start_day
        if end_day < start_day:
            start_day, end_day = end_day, start_day
        start = datetime.combine(start_day, time.min, tzinfo=tz).astimezone(timezone.utc)
        end = datetime.combine(end_day, time.max, tzinfo=tz).astimezone(timezone.utc)
        return start, end, start_day, end_day

    def record_client_events(self, db: Session, items: list[AnalyticsEventInput], user: User | None = None) -> tuple[int, int]:
        inserted = 0
        skipped = 0
        linked_identities: set[tuple[str, str]] = set()
        for item in items:
            existing = db.scalar(select(AnalyticsEvent.id).where(AnalyticsEvent.event_id == item.event_id))
            if existing:
                skipped += 1
                continue
            event = AnalyticsEvent(
                event_id=item.event_id,
                event_name=item.event_name,
                anonymous_id=item.anonymous_id,
                user_id=user.id if user else None,
                session_id=item.session_id,
                style_id=item.style_id,
                tryon_job_id=item.tryon_job_id,
                booking_id=item.booking_id,
                shop_id=item.shop_id,
                source=item.source,
                screen=item.screen,
                amount_cents=item.amount_cents,
                properties_json=item.properties,
                occurred_at=item.occurred_at or self._now(),
            )
            db.add(event)
            inserted += 1
            if user and item.anonymous_id:
                identity_key = (item.anonymous_id, user.id)
                if identity_key not in linked_identities:
                    self._link_identity(db, item.anonymous_id, user.id)
                    linked_identities.add(identity_key)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return self._record_client_events_without_identity_links(db, items, user)
        return inserted, skipped

    def _record_client_events_without_identity_links(
        self,
        db: Session,
        items: list[AnalyticsEventInput],
        user: User | None = None,
    ) -> tuple[int, int]:
        inserted = 0
        skipped = 0
        for item in items:
            existing = db.scalar(select(AnalyticsEvent.id).where(AnalyticsEvent.event_id == item.event_id))
            if existing:
                skipped += 1
                continue
            db.add(
                AnalyticsEvent(
                    event_id=item.event_id,
                    event_name=item.event_name,
                    anonymous_id=item.anonymous_id,
                    user_id=user.id if user else None,
                    session_id=item.session_id,
                    style_id=item.style_id,
                    tryon_job_id=item.tryon_job_id,
                    booking_id=item.booking_id,
                    shop_id=item.shop_id,
                    source=item.source,
                    screen=item.screen,
                    amount_cents=item.amount_cents,
                    properties_json=item.properties,
                    occurred_at=item.occurred_at or self._now(),
                )
            )
            inserted += 1
        db.commit()
        return inserted, skipped

    def record_server_event(
        self,
        db: Session,
        event_name: str,
        *,
        user_id: str | None = None,
        style_id: str | None = None,
        tryon_job_id: str | None = None,
        booking_id: str | None = None,
        shop_id: str | None = None,
        amount_cents: int | None = None,
        source: str = "server",
        screen: str = "",
        properties: dict[str, object] | None = None,
        occurred_at: datetime | None = None,
    ) -> None:
        happened_at = occurred_at or self._now()
        event_id_parts = [event_name, user_id or "anon", style_id or "", tryon_job_id or "", booking_id or "", happened_at.isoformat()]
        event_key = sha1(":".join(event_id_parts).encode("utf-8")).hexdigest()
        event = AnalyticsEvent(
            event_id=f"server:{event_key}",
            event_name=event_name,
            user_id=user_id,
            style_id=style_id,
            tryon_job_id=tryon_job_id,
            booking_id=booking_id,
            shop_id=shop_id,
            amount_cents=amount_cents,
            source=source,
            screen=screen,
            properties_json=properties or {},
            occurred_at=happened_at,
        )
        db.add(event)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    def overview(self, db: Session, start_date: date | None = None, end_date: date | None = None) -> OpsAnalyticsOverviewResponse:
        start, end, start_day, end_day = self._local_window(start_date, end_date)
        events = list(
            db.scalars(
                select(AnalyticsEvent)
                .where(AnalyticsEvent.occurred_at >= start, AnalyticsEvent.occurred_at <= end)
                .order_by(AnalyticsEvent.occurred_at.asc())
            )
        )
        if not events and start_date is None and end_date is None and get_settings().ops_demo_metrics_enabled:
            return self._demo_overview(start_day, end_day)
        anonymous_to_user = dict(db.execute(select(AnalyticsIdentityLink.anonymous_id, AnalyticsIdentityLink.user_id)).all())

        def actor_id(event: AnalyticsEvent) -> str:
            if event.user_id:
                return f"user:{event.user_id}"
            if event.anonymous_id and event.anonymous_id in anonymous_to_user:
                return f"user:{anonymous_to_user[event.anonymous_id]}"
            if event.anonymous_id:
                return f"anon:{event.anonymous_id}"
            if event.session_id:
                return f"session:{event.session_id}"
            return f"event:{event.id}"

        event_counts: dict[str, int] = defaultdict(int)
        event_actors: dict[str, set[str]] = defaultdict(set)
        for event in events:
            event_counts[event.event_name] += 1
            event_actors[event.event_name].add(actor_id(event))

        revenue_cents = sum(event.amount_cents or 0 for event in events if event.event_name == "revenue_recorded")
        completed_orders = event_counts["booking_completed"]
        recommendation_shown = event_counts["ai_recommendation_shown"]
        recommendation_click = event_counts["ai_recommendation_click"]
        tryon_started = event_counts["tryon_started"]
        tryon_completed = event_counts["tryon_completed"]
        booking_submits = event_counts["booking_submit_clicked"]
        new_users = int(
            db.scalar(select(func.count(User.id)).where(User.created_at >= start, User.created_at <= end, User.role == "consumer")) or 0
        )
        active_users = len({actor_id(event) for event in events})

        kpis = OpsAnalyticsKpis(
            dau=active_users,
            new_users=new_users,
            recommendation_impressions=recommendation_shown,
            recommendation_clicks=recommendation_click,
            recommendation_ctr=self._rate(recommendation_click, recommendation_shown),
            tryon_started=tryon_started,
            tryon_completed=tryon_completed,
            tryon_completion_rate=self._rate(tryon_completed, tryon_started),
            booking_submits=booking_submits,
            completed_orders=completed_orders,
            revenue_cents=revenue_cents,
            average_order_value_cents=revenue_cents // completed_orders if completed_orders else 0,
            click_to_tryon_rate=self._rate(tryon_started, recommendation_click),
            tryon_to_booking_rate=self._rate(booking_submits, tryon_completed),
            booking_to_order_rate=self._rate(completed_orders, booking_submits),
            click_to_order_rate=self._rate(completed_orders, recommendation_click),
            arpu_cents=revenue_cents // active_users if active_users else 0,
            revenue_conversion_rate=self._rate(event_counts["revenue_recorded"], booking_submits),
        )

        previous = 0
        funnel: list[OpsAnalyticsFunnelStep] = []
        for index, (name, label) in enumerate(FUNNEL_STEPS):
            count = event_counts[name]
            base = recommendation_shown if index else count
            funnel.append(
                OpsAnalyticsFunnelStep(
                    key=name,
                    label=label,
                    count=count,
                    conversion_rate=1.0 if index == 0 else self._rate(count, base),
                    step_rate=1.0 if index == 0 else self._rate(count, previous),
                    dropoff_rate=0.0 if index == 0 else max(0.0, 1.0 - self._rate(count, previous)),
                    dropoff_count=0 if index == 0 else max(previous - count, 0),
                )
            )
            previous = count

        return OpsAnalyticsOverviewResponse(
            start_date=start_day,
            end_date=end_day,
            generated_at=self._now(),
            kpis=kpis,
            funnel=funnel,
            trends=self._trends(events),
            top_styles=self._top_styles(db, events),
            top_shops=self._top_shops(db, events),
        )

    def _link_identity(self, db: Session, anonymous_id: str, user_id: str) -> None:
        link = db.scalar(
            select(AnalyticsIdentityLink).where(
                AnalyticsIdentityLink.anonymous_id == anonymous_id,
                AnalyticsIdentityLink.user_id == user_id,
            )
        )
        if link:
            link.last_seen_at = self._now()
        else:
            db.add(AnalyticsIdentityLink(anonymous_id=anonymous_id, user_id=user_id))

    def _rate(self, numerator: int, denominator: int) -> float:
        return round(numerator / denominator, 4) if denominator else 0.0

    def _demo_overview(self, start_day: date, end_day: date) -> OpsAnalyticsOverviewResponse:
        impressions = 42860
        clicks = 8230
        tryon_started = 3120
        tryon_completed = 2468
        booking_submits = 612
        completed_orders = 486
        revenue_cents = 11862800
        active_users = 2860
        kpis = OpsAnalyticsKpis(
            dau=active_users,
            new_users=426,
            recommendation_impressions=impressions,
            recommendation_clicks=clicks,
            recommendation_ctr=self._rate(clicks, impressions),
            tryon_started=tryon_started,
            tryon_completed=tryon_completed,
            tryon_completion_rate=self._rate(tryon_completed, tryon_started),
            booking_submits=booking_submits,
            completed_orders=completed_orders,
            revenue_cents=revenue_cents,
            average_order_value_cents=revenue_cents // completed_orders,
            click_to_tryon_rate=self._rate(tryon_started, clicks),
            tryon_to_booking_rate=self._rate(booking_submits, tryon_completed),
            booking_to_order_rate=self._rate(completed_orders, booking_submits),
            click_to_order_rate=self._rate(completed_orders, clicks),
            arpu_cents=revenue_cents // active_users,
            revenue_conversion_rate=self._rate(completed_orders, booking_submits),
        )
        funnel_counts = {
            "ai_recommendation_shown": impressions,
            "ai_recommendation_click": clicks,
            "tryon_started": tryon_started,
            "tryon_completed": tryon_completed,
            "booking_start_clicked": 980,
            "booking_submit_clicked": booking_submits,
            "booking_completed": completed_orders,
        }
        previous = 0
        funnel: list[OpsAnalyticsFunnelStep] = []
        for index, (key, label) in enumerate(FUNNEL_STEPS):
            count = funnel_counts[key]
            base = impressions if index else count
            funnel.append(
                OpsAnalyticsFunnelStep(
                    key=key,
                    label=label,
                    count=count,
                    conversion_rate=1.0 if index == 0 else self._rate(count, base),
                    step_rate=1.0 if index == 0 else self._rate(count, previous),
                    dropoff_rate=0.0 if index == 0 else max(0.0, 1.0 - self._rate(count, previous)),
                    dropoff_count=0 if index == 0 else max(previous - count, 0),
                )
            )
            previous = count

        trend_start = end_day - timedelta(days=6)
        trends = [
            OpsAnalyticsTrendPoint(
                date=trend_start + timedelta(days=index),
                recommendation_clicks=value,
                tryon_started=int(value * 0.38),
                tryons=int(value * 0.38),
                tryon_completed=int(value * 0.3),
                booking_submits=int(value * 0.08),
                bookings=int(value * 0.08),
                completed_orders=int(value * 0.065),
                revenue_cents=int(value * 0.065 * 24400),
            )
            for index, value in enumerate([760, 920, 1060, 1180, 1320, 1450, 1540])
        ]
        top_styles = [
            self._demo_rank_item("demo-style-1", "春夏清透猫眼", 9200, 1780, 682, 138, 112, 2732800, 0.2304),
            self._demo_rank_item("demo-style-2", "裸粉通勤法式", 7600, 1426, 538, 112, 86, 2098400, 0.1769),
            self._demo_rank_item("demo-style-3", "显白碎钻渐变", 6480, 1180, 456, 94, 76, 1854400, 0.1563),
            self._demo_rank_item("demo-style-4", "甜酷黑银线条", 5360, 960, 348, 78, 61, 1488400, 0.1255),
        ]
        top_shops = [
            self._demo_rank_item("demo-shop-1", "焕甲美学 静安店", 13200, 2460, 884, 186, 148, 3611200, 0.3044),
            self._demo_rank_item("demo-shop-2", "Nail Lab 天河店", 9800, 1810, 692, 138, 112, 2732800, 0.2304),
            self._demo_rank_item("demo-shop-3", "指尖研究所 西湖店", 8200, 1490, 534, 106, 84, 2049600, 0.1728),
        ]
        return OpsAnalyticsOverviewResponse(
            start_date=start_day,
            end_date=end_day,
            generated_at=self._now(),
            kpis=kpis,
            funnel=funnel,
            trends=trends,
            top_styles=top_styles,
            top_shops=top_shops,
        )

    def _demo_rank_item(
        self,
        item_id: str,
        name: str,
        impressions: int,
        clicks: int,
        tryons: int,
        bookings: int,
        completed: int,
        revenue_cents: int,
        revenue_share: float,
    ) -> OpsAnalyticsRankItem:
        return OpsAnalyticsRankItem(
            id=item_id,
            name=name,
            image_url=None,
            impressions=impressions,
            clicks=clicks,
            ctr=self._rate(clicks, impressions),
            tryons=tryons,
            tryon_rate=self._rate(tryons, clicks),
            bookings=bookings,
            booking_rate=self._rate(bookings, tryons),
            completed_orders=completed,
            completion_rate=self._rate(completed, bookings),
            revenue_cents=revenue_cents,
            revenue_share=revenue_share,
        )

    def _trends(self, events: list[AnalyticsEvent]) -> list[OpsAnalyticsTrendPoint]:
        buckets: dict[date, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        tz = ZoneInfo(get_settings().ops_report_timezone)
        for event in events:
            day = event.occurred_at.astimezone(tz).date()
            buckets[day][event.event_name] += 1
            if event.event_name == "revenue_recorded":
                buckets[day]["revenue_cents"] += event.amount_cents or 0
        return [
            OpsAnalyticsTrendPoint(
                date=day,
                recommendation_clicks=values["ai_recommendation_click"],
                tryon_started=values["tryon_started"],
                tryons=values["tryon_started"],
                tryon_completed=values["tryon_completed"],
                booking_submits=values["booking_submit_clicked"],
                bookings=values["booking_submit_clicked"],
                completed_orders=values["booking_completed"],
                revenue_cents=values["revenue_cents"],
            )
            for day, values in sorted(buckets.items())
        ]

    def _top_styles(self, db: Session, events: list[AnalyticsEvent]) -> list[OpsAnalyticsRankItem]:
        grouped: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for event in events:
            if not event.style_id:
                continue
            grouped[event.style_id][event.event_name] += 1
            if event.event_name == "revenue_recorded":
                grouped[event.style_id]["revenue_cents"] += event.amount_cents or 0
        return self._rank_items(db, grouped, "style")

    def _top_shops(self, db: Session, events: list[AnalyticsEvent]) -> list[OpsAnalyticsRankItem]:
        grouped: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for event in events:
            if not event.shop_id:
                continue
            grouped[event.shop_id][event.event_name] += 1
            if event.event_name == "revenue_recorded":
                grouped[event.shop_id]["revenue_cents"] += event.amount_cents or 0
        return self._rank_items(db, grouped, "shop")

    def _rank_items(self, db: Session, grouped: dict[str, dict[str, int]], kind: str) -> list[OpsAnalyticsRankItem]:
        items: list[OpsAnalyticsRankItem] = []
        total_revenue = sum(values["revenue_cents"] for values in grouped.values())
        for item_id, values in grouped.items():
            if kind == "style":
                item = db.get(NailStyle, item_id)
                name = item.title if item else "未知款式"
                image_url = item.image_url if item else None
            else:
                item = db.get(MerchantShop, item_id)
                name = item.name if item else "未知门店"
                image_url = None
            impressions = values["ai_recommendation_shown"] + values["style_impression"]
            clicks = values["ai_recommendation_click"] + values["style_click"]
            tryons = values["tryon_started"]
            bookings = values["booking_submit_clicked"]
            completed = values["booking_completed"]
            items.append(
                OpsAnalyticsRankItem(
                    id=item_id,
                    name=name,
                    image_url=image_url,
                    impressions=impressions,
                    clicks=clicks,
                    ctr=self._rate(clicks, impressions),
                    tryons=tryons,
                    tryon_rate=self._rate(tryons, clicks),
                    bookings=bookings,
                    booking_rate=self._rate(bookings, tryons),
                    completed_orders=completed,
                    completion_rate=self._rate(completed, bookings),
                    revenue_cents=values["revenue_cents"],
                    revenue_share=self._rate(values["revenue_cents"], total_revenue),
                )
            )
        return sorted(items, key=lambda item: (item.revenue_cents, item.completed_orders, item.tryons, item.clicks), reverse=True)[:10]
