from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.models.direct_message import DirectMessage
from app.models.merchant_shop import MerchantShop
from app.models.mixins import utcnow
from app.models.nail_style import NailStyle
from app.models.user import User
from app.services.block_service import BlockService
from app.services.follow_service import FollowService


@dataclass
class MessageThreadSummary:
    target: User
    last_message: DirectMessage
    unread_count: int
    has_outbound: bool
    has_inbound: bool
    can_send: bool
    is_mutual_follow: bool
    viewer_follows_target: bool
    blocked_by_target: bool
    viewer_has_blocked_target: bool
    notice: str | None
    is_stranger_source: bool
    is_mute_placeholder: bool = False


class MessageService:
    def __init__(self) -> None:
        self.follow_service = FollowService()
        self.block_service = BlockService()

    def get_target(self, db: Session, current_user: User, target_user_id: str) -> User:
        target = db.get(User, target_user_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
        if target.id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能给自己发私信")
        return target

    def can_show_thread(self, current_user: User, target: User) -> bool:
        return current_user.id != target.id

    def mark_conversation_as_read(self, db: Session, current_user: User, target_user_id: str) -> None:
        result = db.execute(
            update(DirectMessage)
            .where(
                DirectMessage.sender_user_id == target_user_id,
                DirectMessage.recipient_user_id == current_user.id,
                DirectMessage.read_at.is_(None),
            )
            .values(read_at=utcnow())
        )
        if result.rowcount:
            db.commit()

    def mark_all_as_read(self, db: Session, current_user: User) -> int:
        result = db.execute(
            update(DirectMessage)
            .where(
                DirectMessage.recipient_user_id == current_user.id,
                DirectMessage.read_at.is_(None),
            )
            .values(read_at=utcnow())
        )
        updated_count = int(result.rowcount or 0)
        if updated_count:
            db.commit()
        return updated_count

    def list_conversation(self, db: Session, current_user: User, target_user_id: str) -> tuple[User, list[DirectMessage], dict[str, object]]:
        target = self.get_target(db, current_user, target_user_id)
        self.mark_conversation_as_read(db, current_user, target.id)
        items = list(
            db.scalars(
                select(DirectMessage)
                .where(
                    or_(
                        (DirectMessage.sender_user_id == current_user.id)
                        & (DirectMessage.recipient_user_id == target.id),
                        (DirectMessage.sender_user_id == target.id)
                        & (DirectMessage.recipient_user_id == current_user.id),
                    )
                )
                .order_by(DirectMessage.created_at.asc())
            ).all()
        )
        state = self.get_send_state(db, current_user, target)
        return target, items, state

    def get_send_state(self, db: Session, current_user: User, target: User) -> dict[str, object]:
        blocked_by_target, viewer_has_blocked_target = self.block_service.get_relationship(db, current_user.id, target.id)
        follows_target = self.follow_service.is_following(db, current_user.id, target.id)
        target_follows_viewer = self.follow_service.is_following(db, target.id, current_user.id)
        is_mutual_follow = follows_target and target_follows_viewer

        if blocked_by_target:
            return {
                "can_send": False,
                "blocked_by_target": True,
                "viewer_has_blocked_target": viewer_has_blocked_target,
                "is_mutual_follow": is_mutual_follow,
                "viewer_follows_target": follows_target,
                "notice": "对方已设置不再看你",
            }
        if viewer_has_blocked_target:
            return {
                "can_send": False,
                "blocked_by_target": False,
                "viewer_has_blocked_target": True,
                "is_mutual_follow": is_mutual_follow,
                "viewer_follows_target": follows_target,
                "notice": "你已设置不再看她，恢复后才能继续私信",
            }

        return {
            "can_send": True,
            "blocked_by_target": False,
            "viewer_has_blocked_target": False,
            "is_mutual_follow": is_mutual_follow,
            "viewer_follows_target": follows_target,
            "notice": None,
        }

    def list_inbox(self, db: Session, current_user: User) -> dict[str, object]:
        summaries = self._build_thread_summaries(db, current_user)
        stranger_summaries, main_summaries = self._split_stranger_threads(summaries)
        latest_stranger = stranger_summaries[0] if stranger_summaries else None
        stranger_unread_count = sum(item.unread_count for item in stranger_summaries)

        return {
            "stranger_bucket": (
                {
                    "unread_count": stranger_unread_count,
                    "thread_count": len(stranger_summaries),
                    "latest_message_preview": self._message_preview(latest_stranger.last_message) if latest_stranger else None,
                    "latest_message_at": latest_stranger.last_message.created_at if latest_stranger else None,
                }
                if stranger_summaries
                else None
            ),
            "items": main_summaries,
            "badge": {
                "has_stranger_unread": stranger_unread_count > 0,
                "main_unread_count": sum(item.unread_count for item in main_summaries),
            },
        }

    def list_stranger_messages(self, db: Session, current_user: User) -> list[MessageThreadSummary]:
        stranger_summaries, _ = self._split_stranger_threads(self._build_thread_summaries(db, current_user))
        return stranger_summaries

    def send_message(
        self,
        db: Session,
        current_user: User,
        target_user_id: str,
        content: str = "",
        image_url: str | None = None,
        local_image_path: str | None = None,
        shared_style_id: str | None = None,
        booking_invite_shop_id: str | None = None,
    ) -> DirectMessage:
        target = self.get_target(db, current_user, target_user_id)
        body = content.strip()
        if shared_style_id is not None and db.get(NailStyle, shared_style_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="美甲不存在")
        if booking_invite_shop_id is not None and db.get(MerchantShop, booking_invite_shop_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
        if not body and not image_url and not shared_style_id and not booking_invite_shop_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="消息内容不能为空")

        state = self.get_send_state(db, current_user, target)
        if not state["can_send"]:
            detail = str(state["notice"] or "当前无法发送私信")
            status_code = (
                status.HTTP_403_FORBIDDEN
                if state["blocked_by_target"] or state["viewer_has_blocked_target"]
                else status.HTTP_429_TOO_MANY_REQUESTS
            )
            raise HTTPException(status_code=status_code, detail=detail)

        message = DirectMessage(
            sender_user_id=current_user.id,
            recipient_user_id=target.id,
            content=body,
            image_url=image_url,
            local_image_path=local_image_path,
            shared_style_id=shared_style_id,
            booking_invite_shop_id=booking_invite_shop_id,
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    def _build_thread_summaries(self, db: Session, current_user: User) -> list[MessageThreadSummary]:
        messages = list(
            db.scalars(
                select(DirectMessage)
                .where(
                    or_(
                        DirectMessage.sender_user_id == current_user.id,
                        DirectMessage.recipient_user_id == current_user.id,
                    )
                )
                .order_by(DirectMessage.created_at.desc())
            ).all()
        )
        if not messages:
            return []

        target_ids: list[str] = []
        aggregates: dict[str, dict[str, object]] = {}
        for item in messages:
            target_id = item.recipient_user_id if item.sender_user_id == current_user.id else item.sender_user_id
            aggregate = aggregates.get(target_id)
            if aggregate is None:
                aggregate = {
                    "last_message": item,
                    "unread_count": 0,
                    "has_outbound": False,
                    "has_inbound": False,
                }
                aggregates[target_id] = aggregate
                target_ids.append(target_id)

            if item.sender_user_id == current_user.id:
                aggregate["has_outbound"] = True
            else:
                aggregate["has_inbound"] = True
                if item.read_at is None:
                    aggregate["unread_count"] = int(aggregate["unread_count"]) + 1

        users = list(db.scalars(select(User).where(User.id.in_(target_ids))).all()) if target_ids else []
        user_map = {item.id: item for item in users}

        items: list[MessageThreadSummary] = []
        for target_id in target_ids:
            target = user_map.get(target_id)
            if target is None:
                continue
            if not self.can_show_thread(current_user, target):
                continue

            aggregate = aggregates[target_id]
            state = self.get_send_state(db, current_user, target)
            has_outbound = bool(aggregate["has_outbound"])
            has_inbound = bool(aggregate["has_inbound"])

            items.append(
                MessageThreadSummary(
                    target=target,
                    last_message=aggregate["last_message"],
                    unread_count=int(aggregate["unread_count"]),
                    has_outbound=has_outbound,
                    has_inbound=has_inbound,
                    can_send=bool(state["can_send"]),
                    is_mutual_follow=bool(state["is_mutual_follow"]),
                    viewer_follows_target=bool(state["viewer_follows_target"]),
                    blocked_by_target=bool(state["blocked_by_target"]),
                    viewer_has_blocked_target=bool(state["viewer_has_blocked_target"]),
                    notice=state["notice"],
                    is_stranger_source=False,
                )
            )
        return items

    def _split_stranger_threads(
        self,
        summaries: list[MessageThreadSummary],
    ) -> tuple[list[MessageThreadSummary], list[MessageThreadSummary]]:
        strangers: list[MessageThreadSummary] = []
        main: list[MessageThreadSummary] = []
        for item in summaries:
            is_stranger = item.has_inbound and not item.has_outbound and not item.is_mutual_follow
            if is_stranger:
                item.is_stranger_source = True
                strangers.append(item)
            else:
                item.is_stranger_source = False
                main.append(item)
        return strangers, main

    def _message_preview(self, item: DirectMessage) -> str:
        if item.content:
            return item.content
        if item.booking_invite_shop_id:
            return "[邀请预约]"
        if item.shared_style_id:
            return "[美甲]"
        if item.image_url:
            return "[图片]"
        return ""
