from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.merchant_trend import MerchantNotification, MerchantTrendClaim
from app.models.nail_style import NailStyle
from app.models.trend_nail_campaign import TrendNailCampaign, TrendNailCampaignStyle
from app.models.user import User
from app.models.user_style_like import UserStyleLike
from app.schemas.trends import (
    MerchantTrendClaimRead,
    MerchantTrendNotificationRead,
    OpsTrendCampaignCreateRequest,
    OpsTrendCampaignRead,
    TrendNailStyleRead,
)
from app.services.merchant_service import MerchantShopService, require_merchant


class TrendNailService:
    def __init__(self) -> None:
        self.shop_service = MerchantShopService()

    def list_candidates(self, db: Session, *, limit: int = 20) -> list[TrendNailStyleRead]:
        styles = list(
            db.scalars(
                select(NailStyle)
                .where(NailStyle.nail_type == "handmade")
                .order_by(NailStyle.is_trending.desc(), NailStyle.popularity_score.desc(), NailStyle.created_at.desc())
                .limit(max(1, min(limit, 100)))
            )
        )
        return [self._style_read(db, style) for style in styles]

    def create_campaign(self, db: Session, payload: OpsTrendCampaignCreateRequest, *, created_by: str) -> OpsTrendCampaignRead:
        style_ids = list(dict.fromkeys(payload.style_ids))
        styles = list(db.scalars(select(NailStyle).where(NailStyle.id.in_(style_ids), NailStyle.nail_type == "handmade")))
        if not styles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择至少一个手工甲款式")

        merchant_query = select(User).where(User.role == "merchant")
        if payload.merchant_user_ids:
            merchant_query = merchant_query.where(User.id.in_(payload.merchant_user_ids))
        merchants = list(db.scalars(merchant_query.order_by(User.created_at.desc())))

        campaign = TrendNailCampaign(
            title=payload.title.strip(),
            description=payload.description.strip(),
            status="sent",
            created_by=created_by,
        )
        db.add(campaign)
        db.flush()

        for style in styles:
            db.add(TrendNailCampaignStyle(campaign_id=campaign.id, style_id=style.id))

        for merchant in merchants:
            db.add(
                MerchantNotification(
                    merchant_user_id=merchant.id,
                    campaign_id=campaign.id,
                    title=campaign.title,
                    body=campaign.description or "运营团队给你推送了几款近期热门手工甲，可登记你能做的款式。",
                )
            )

        db.commit()
        db.refresh(campaign)
        return self.get_campaign(db, campaign.id)

    def get_campaign(self, db: Session, campaign_id: str) -> OpsTrendCampaignRead:
        campaign = db.get(TrendNailCampaign, campaign_id)
        if campaign is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推送方案不存在")
        styles = [
            self._style_read(db, item.style)
            for item in sorted(campaign.styles, key=lambda campaign_style: campaign_style.created_at)
            if item.style is not None
        ]
        merchant_count = int(
            db.scalar(select(func.count(MerchantNotification.id)).where(MerchantNotification.campaign_id == campaign.id)) or 0
        )
        claim_count = int(db.scalar(select(func.count(MerchantTrendClaim.id)).where(MerchantTrendClaim.campaign_id == campaign.id)) or 0)
        return OpsTrendCampaignRead(
            id=campaign.id,
            title=campaign.title,
            description=campaign.description,
            status=campaign.status,
            created_by=campaign.created_by,
            created_at=campaign.created_at,
            merchant_count=merchant_count,
            claim_count=claim_count,
            styles=styles,
        )

    def list_merchant_notifications(self, db: Session, user: User) -> list[MerchantTrendNotificationRead]:
        require_merchant(user)
        shops = self.shop_service.list_for_merchant(db, user)
        default_shop = shops[0] if shops else None
        claimed_style_ids = self._claimed_style_ids(db, default_shop.id) if default_shop else set()
        notifications = list(
            db.scalars(
                select(MerchantNotification)
                .where(MerchantNotification.merchant_user_id == user.id)
                .order_by(MerchantNotification.created_at.desc())
                .limit(50)
            )
        )
        items: list[MerchantTrendNotificationRead] = []
        for notification in notifications:
            styles: list[TrendNailStyleRead] = []
            if notification.campaign is not None:
                styles = [
                    self._style_read(db, campaign_style.style, claimed_style_ids=claimed_style_ids)
                    for campaign_style in sorted(notification.campaign.styles, key=lambda item: item.created_at)
                    if campaign_style.style is not None
                ]
            items.append(
                MerchantTrendNotificationRead(
                    id=notification.id,
                    campaign_id=notification.campaign_id,
                    title=notification.title,
                    body=notification.body,
                    read_at=notification.read_at,
                    created_at=notification.created_at,
                    styles=styles,
                )
            )
        return items

    def claim_style(self, db: Session, user: User, *, style_id: str, campaign_id: str | None = None) -> MerchantTrendClaimRead:
        require_merchant(user)
        style = db.get(NailStyle, style_id)
        if style is None or style.nail_type != "handmade":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="手工甲款式不存在")
        if campaign_id and db.get(TrendNailCampaign, campaign_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推送方案不存在")

        shop = self.shop_service.get_default_shop(db, user)
        claim = db.scalar(select(MerchantTrendClaim).where(MerchantTrendClaim.shop_id == shop.id, MerchantTrendClaim.style_id == style.id))
        if claim is None:
            claim = MerchantTrendClaim(
                merchant_user_id=user.id,
                shop_id=shop.id,
                style_id=style.id,
                campaign_id=campaign_id,
            )
            db.add(claim)
        elif campaign_id and claim.campaign_id is None:
            claim.campaign_id = campaign_id
            db.add(claim)
        db.commit()
        db.refresh(claim)
        return MerchantTrendClaimRead(style_id=claim.style_id, shop_id=claim.shop_id, campaign_id=claim.campaign_id)

    def delete_claim(self, db: Session, user: User, *, style_id: str) -> None:
        require_merchant(user)
        shops = self.shop_service.list_for_merchant(db, user)
        shop_ids = [shop.id for shop in shops]
        if not shop_ids:
            return
        claim = db.scalar(select(MerchantTrendClaim).where(MerchantTrendClaim.shop_id.in_(shop_ids), MerchantTrendClaim.style_id == style_id))
        if claim is not None:
            db.delete(claim)
            db.commit()

    def _style_read(
        self,
        db: Session,
        style: NailStyle,
        *,
        claimed_style_ids: set[str] | None = None,
    ) -> TrendNailStyleRead:
        like_count = int(db.scalar(select(func.count(UserStyleLike.id)).where(UserStyleLike.nail_style_id == style.id)) or 0)
        claim_count = int(db.scalar(select(func.count(MerchantTrendClaim.id)).where(MerchantTrendClaim.style_id == style.id)) or 0)
        return TrendNailStyleRead(
            id=style.id,
            title=style.title,
            description=style.description,
            image_url=style.image_url,
            tags=list(style.tags_json or [])[:8],
            popularity_score=style.popularity_score,
            like_count=like_count,
            claim_count=claim_count,
            can_do_style=style.id in (claimed_style_ids or set()),
        )

    @staticmethod
    def _claimed_style_ids(db: Session, shop_id: str) -> set[str]:
        return set(db.scalars(select(MerchantTrendClaim.style_id).where(MerchantTrendClaim.shop_id == shop_id)))
