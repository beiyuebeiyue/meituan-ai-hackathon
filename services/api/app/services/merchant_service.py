from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.user import User
from app.models.user_post import UserPost


KEKE_SHOP_ADDRESS = "龙岗区香港中文大学深圳图书馆"
KEKE_SHOP_LATITUDE = 22.683980
KEKE_SHOP_LONGITUDE = 114.208552


def require_merchant(user: User) -> None:
    if user.role != "merchant":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅商家账号可使用该功能")


class MerchantShopService:
    def list_for_merchant(self, db: Session, user: User) -> list[MerchantShop]:
        return list(
            db.scalars(
                select(MerchantShop)
                .where(MerchantShop.merchant_user_id == user.id)
                .order_by(MerchantShop.is_default.desc(), MerchantShop.created_at.asc())
            )
        )

    def get_default_shop(self, db: Session, user: User) -> MerchantShop:
        require_merchant(user)
        shop = db.scalar(
            select(MerchantShop)
            .where(MerchantShop.merchant_user_id == user.id)
            .order_by(MerchantShop.is_default.desc(), MerchantShop.created_at.asc())
        )
        if shop is None:
            shop = self.create(
                db,
                user,
                name=user.username,
                city=user.location_city or "深圳",
                address="深圳市南山区",
                latitude=22.5431,
                longitude=114.0579,
                contact_phone=user.phone,
                is_default=True,
            )
        return shop

    def get_owned_shop(self, db: Session, user: User, shop_id: str) -> MerchantShop:
        require_merchant(user)
        shop = db.get(MerchantShop, shop_id)
        if shop is None or shop.merchant_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
        return shop

    def create(
        self,
        db: Session,
        user: User,
        *,
        name: str,
        city: str,
        address: str = "",
        latitude: float | None = None,
        longitude: float | None = None,
        contact_phone: str | None = None,
        is_default: bool = True,
    ) -> MerchantShop:
        require_merchant(user)
        if is_default:
            for item in self.list_for_merchant(db, user):
                item.is_default = False
                db.add(item)
        shop = MerchantShop(
            merchant_user_id=user.id,
            name=name.strip(),
            city=city.strip() or "深圳",
            address=address.strip(),
            latitude=latitude,
            longitude=longitude,
            contact_phone=contact_phone,
            is_default=is_default,
        )
        db.add(shop)
        db.commit()
        db.refresh(shop)
        return shop

    def update(self, db: Session, user: User, shop_id: str, **payload: object) -> MerchantShop:
        shop = self.get_owned_shop(db, user, shop_id)
        if payload.get("is_default") is True:
            for item in self.list_for_merchant(db, user):
                if item.id != shop.id:
                    item.is_default = False
                    db.add(item)
        for field_name in ("name", "city", "address", "latitude", "longitude", "contact_phone", "is_default"):
            if field_name not in payload or payload[field_name] is None:
                continue
            value = payload[field_name]
            if isinstance(value, str):
                value = value.strip()
            setattr(shop, field_name, value)
        db.add(shop)
        db.commit()
        db.refresh(shop)
        return shop

    def ensure_default_admin_shop(self, db: Session, admin_user: User | None) -> MerchantShop | None:
        if admin_user is None:
            return None
        admin_user.role = "merchant"
        if not admin_user.location_city:
            admin_user.location_city = "深圳"
        db.add(admin_user)
        db.flush()

        shop = db.scalar(
            select(MerchantShop)
            .where(MerchantShop.merchant_user_id == admin_user.id)
            .order_by(MerchantShop.is_default.desc(), MerchantShop.created_at.asc())
        )
        settings = get_settings()
        if shop is None:
            shop = MerchantShop(
                merchant_user_id=admin_user.id,
                name=admin_user.username,
                city="深圳",
                address=KEKE_SHOP_ADDRESS,
                latitude=KEKE_SHOP_LATITUDE,
                longitude=KEKE_SHOP_LONGITUDE,
                contact_phone=settings.default_admin_phone,
                is_default=True,
            )
            db.add(shop)
            db.flush()
        elif not shop.is_default:
            shop.is_default = True
            db.add(shop)
        if shop.name != admin_user.username:
            shop.name = admin_user.username
            db.add(shop)
        if shop.contact_phone != settings.default_admin_phone:
            shop.contact_phone = settings.default_admin_phone
            db.add(shop)
        if shop.city != "深圳":
            shop.city = "深圳"
            db.add(shop)
        if shop.address != KEKE_SHOP_ADDRESS:
            shop.address = KEKE_SHOP_ADDRESS
            db.add(shop)
        if shop.latitude != KEKE_SHOP_LATITUDE:
            shop.latitude = KEKE_SHOP_LATITUDE
            db.add(shop)
        if shop.longitude != KEKE_SHOP_LONGITUDE:
            shop.longitude = KEKE_SHOP_LONGITUDE
            db.add(shop)

        for post in db.scalars(select(UserPost).where(UserPost.user_id == admin_user.id, UserPost.shop_id.is_(None))):
            post.shop_id = shop.id
            db.add(post)
        for style in db.scalars(select(NailStyle).where(NailStyle.shop_id.is_(None))):
            metadata = style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
            author_user_id = metadata.get("author_user_id")
            if author_user_id is None or author_user_id == admin_user.id or style.source_type == "seed_xlsx":
                style.shop_id = shop.id
                metadata["author_user_id"] = admin_user.id
                style.style_metadata_json = metadata
                db.add(style)
        db.commit()
        db.refresh(shop)
        return shop
