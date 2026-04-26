from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.models.direct_message import DirectMessage
from app.models.mixins import utcnow
from app.models.user import User
from app.services.block_service import BlockService
from app.services.follow_service import FollowService


def _normalize_datetime(value):
    if value.tzinfo is None:
        return value
    return value.astimezone().replace(tzinfo=None)


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
                "notice": "对方已将您拉黑",
            }
        if viewer_has_blocked_target:
            return {
                "can_send": False,
                "blocked_by_target": False,
                "viewer_has_blocked_target": True,
                "is_mutual_follow": is_mutual_follow,
                "viewer_follows_target": follows_target,
                "notice": "你已拉黑对方，解除后才能继续私信",
            }
        if is_mutual_follow:
            return {
                "can_send": True,
                "blocked_by_target": False,
                "viewer_has_blocked_target": False,
                "is_mutual_follow": True,
                "viewer_follows_target": True,
                "notice": None,
            }

        notice = "对方关注或回复你之前，24小时内只能发送1条消息"
        latest_outbound = db.scalar(
            select(DirectMessage)
            .where(
                DirectMessage.sender_user_id == current_user.id,
                DirectMessage.recipient_user_id == target.id,
            )
            .order_by(DirectMessage.created_at.desc())
            .limit(1)
        )
        if latest_outbound is None:
            return {
                "can_send": True,
                "blocked_by_target": False,
                "viewer_has_blocked_target": False,
                "is_mutual_follow": False,
                "viewer_follows_target": follows_target,
                "notice": notice,
            }

        has_reply = db.scalar(
            select(DirectMessage.id)
            .where(
                DirectMessage.sender_user_id == target.id,
                DirectMessage.recipient_user_id == current_user.id,
                DirectMessage.created_at > latest_outbound.created_at,
            )
            .limit(1)
        )
        if has_reply is not None or _normalize_datetime(latest_outbound.created_at) <= _normalize_datetime(utcnow() - timedelta(hours=24)):
            return {
                "can_send": True,
                "blocked_by_target": False,
                "viewer_has_blocked_target": False,
                "is_mutual_follow": False,
                "viewer_follows_target": follows_target,
                "notice": notice,
            }

        return {
            "can_send": False,
            "blocked_by_target": False,
            "viewer_has_blocked_target": False,
            "is_mutual_follow": False,
            "viewer_follows_target": follows_target,
            "notice": notice,
        }

    def list_inbox(self, db: Session, current_user: User) -> dict[str, object]:
        summaries = self._build_thread_summaries(db, current_user)
        stranger_items = [item for item in summaries if item.is_stranger_source]
        main_items = [item for item in summaries if not item.is_stranger_source]

        stranger_bucket = None
        if stranger_items:
            stranger_bucket = {
                "unread_count": sum(item.unread_count for item in stranger_items),
                "thread_count": len(stranger_items),
                "latest_message_preview": stranger_items[0].last_message.content,
                "latest_message_at": stranger_items[0].last_message.created_at,
            }

        return {
            "stranger_bucket": stranger_bucket,
            "items": main_items,
            "badge": {
                "has_stranger_unread": any(item.unread_count > 0 for item in stranger_items),
                "main_unread_count": sum(item.unread_count for item in main_items),
            },
        }

    def list_stranger_messages(self, db: Session, current_user: User) -> list[MessageThreadSummary]:
        return [item for item in self._build_thread_summaries(db, current_user) if item.is_stranger_source]

    def send_message(self, db: Session, current_user: User, target_user_id: str, content: str) -> DirectMessage:
        target = self.get_target(db, current_user, target_user_id)
        body = content.strip()
        if not body:
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

            aggregate = aggregates[target_id]
            state = self.get_send_state(db, current_user, target)
            has_outbound = bool(aggregate["has_outbound"])
            has_inbound = bool(aggregate["has_inbound"])
            is_stranger_source = has_inbound and not has_outbound and not bool(state["is_mutual_follow"])

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
                    is_stranger_source=is_stranger_source,
                )
            )
        return items
