from __future__ import annotations

from app.models.user import User


DEFAULT_CONSUMER_AVATAR_URL = (
    "https://pub-17b30b99b4d24df39184b3477620adcd.r2.dev/app/default-avatars/consumer.png"
)
DEFAULT_MERCHANT_AVATAR_URL = (
    "https://pub-17b30b99b4d24df39184b3477620adcd.r2.dev/app/default-avatars/merchant.png"
)


def default_avatar_url_for_role(role: str | None) -> str:
    if role == "merchant":
        return DEFAULT_MERCHANT_AVATAR_URL
    return DEFAULT_CONSUMER_AVATAR_URL


def avatar_url_for_user(user: User | None) -> str | None:
    if user is None:
        return None
    return default_avatar_url_for_role(user.role)
