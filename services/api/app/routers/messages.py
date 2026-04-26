from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.messages import (
    DirectMessageCreateRequest,
    DirectMessageRead,
    DirectMessageTargetRead,
    DirectMessageThreadRead,
    MessageBadgeSummaryRead,
    MessageInboxRead,
    MessageInboxThreadRead,
    StrangerBucketSummaryRead,
    StrangerMessageListRead,
)
from app.services.message_service import MessageService, MessageThreadSummary


router = APIRouter(prefix="/messages", tags=["messages"])
message_service = MessageService()


def _serialize_target(target: User) -> DirectMessageTargetRead:
    return DirectMessageTargetRead(
        id=target.id,
        uid=target.uid,
        username=target.username,
        avatar_url=target.avatar_url,
    )


def _serialize_message(current_user: User, item) -> DirectMessageRead:
    return DirectMessageRead(
        id=item.id,
        sender_user_id=item.sender_user_id,
        recipient_user_id=item.recipient_user_id,
        content=item.content,
        created_at=item.created_at,
        is_mine=item.sender_user_id == current_user.id,
        read_at=item.read_at,
    )


def _serialize_thread_summary(current_user: User, item: MessageThreadSummary) -> MessageInboxThreadRead:
    return MessageInboxThreadRead(
        target=_serialize_target(item.target),
        last_message_preview=item.last_message.content,
        last_message_at=item.last_message.created_at,
        last_message_is_mine=item.last_message.sender_user_id == current_user.id,
        unread_count=item.unread_count,
        is_muted=item.is_mute_placeholder,
        is_stranger_source=item.is_stranger_source,
        can_send=item.can_send,
        is_mutual_follow=item.is_mutual_follow,
        viewer_follows_target=item.viewer_follows_target,
        blocked_by_target=item.blocked_by_target,
        viewer_has_blocked_target=item.viewer_has_blocked_target,
    )


@router.get("/inbox", response_model=MessageInboxRead)
def get_message_inbox(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageInboxRead:
    payload = message_service.list_inbox(db, user)
    stranger_bucket = payload["stranger_bucket"]
    return MessageInboxRead(
        stranger_bucket=(
            StrangerBucketSummaryRead(
                unread_count=stranger_bucket["unread_count"],
                thread_count=stranger_bucket["thread_count"],
                latest_message_preview=stranger_bucket["latest_message_preview"],
                latest_message_at=stranger_bucket["latest_message_at"],
            )
            if stranger_bucket
            else None
        ),
        items=[_serialize_thread_summary(user, item) for item in payload["items"]],
        badge=MessageBadgeSummaryRead(
            has_stranger_unread=bool(payload["badge"]["has_stranger_unread"]),
            main_unread_count=int(payload["badge"]["main_unread_count"]),
        ),
    )


@router.get("/strangers", response_model=StrangerMessageListRead)
def get_stranger_messages(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StrangerMessageListRead:
    return StrangerMessageListRead(items=[_serialize_thread_summary(user, item) for item in message_service.list_stranger_messages(db, user)])


@router.get("/conversations/{target_user_id}", response_model=DirectMessageThreadRead)
def get_conversation(
    target_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageThreadRead:
    target, items, state = message_service.list_conversation(db, user, target_user_id)
    return DirectMessageThreadRead(
        target=_serialize_target(target),
        items=[_serialize_message(user, item) for item in items],
        can_send=bool(state["can_send"]),
        is_mutual_follow=bool(state["is_mutual_follow"]),
        viewer_follows_target=bool(state["viewer_follows_target"]),
        blocked_by_target=bool(state["blocked_by_target"]),
        viewer_has_blocked_target=bool(state["viewer_has_blocked_target"]),
        notice=state["notice"],
    )


@router.post("/conversations/{target_user_id}", response_model=DirectMessageRead)
def create_message(
    target_user_id: str,
    payload: DirectMessageCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageRead:
    item = message_service.send_message(db, user, target_user_id, payload.content)
    return _serialize_message(user, item)
