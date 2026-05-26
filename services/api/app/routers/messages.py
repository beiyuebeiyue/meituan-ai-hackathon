from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.messages import (
    DirectMessageBookingInviteCreateRequest,
    DirectMessageBookingInviteRead,
    DirectMessageCreateRequest,
    DirectMessageRead,
    DirectMessageSharedStyleRead,
    DirectMessageStyleCreateRequest,
    DirectMessageTargetRead,
    DirectMessageThreadRead,
    DirectMessageTryOnResultCreateRequest,
    MessageBadgeSummaryRead,
    MessageInboxRead,
    MessageInboxThreadRead,
    StrangerBucketSummaryRead,
    StrangerMessageListRead,
)
from app.models.tryon_job import TryOnJob
from app.services.merchant_service import MerchantShopService
from app.services.message_service import MessageService, MessageThreadSummary
from app.services.style_service import StyleService
from app.utils.files import public_url_for_path, relative_to_base, save_user_upload_file, user_upload_dir


router = APIRouter(prefix="/messages", tags=["messages"])
message_service = MessageService()
style_service = StyleService()
merchant_shop_service = MerchantShopService()


def _serialize_target(target: User) -> DirectMessageTargetRead:
    return DirectMessageTargetRead(
        id=target.id,
        uid=target.uid,
        username=target.username,
        role=target.role,
        is_shop=target.role == "merchant",
        avatar_url=target.avatar_url,
    )


def _serialize_message(db: Session, current_user: User, item) -> DirectMessageRead:
    shared_style = None
    if item.shared_style_id and item.shared_style is not None:
        author = style_service.resolve_style_author_user(db, item.shared_style)
        shared_style = DirectMessageSharedStyleRead(
            id=item.shared_style.id,
            title=item.shared_style.title,
            image_url=item.shared_style.image_url,
            author_name=author.username if author else "焕甲图库",
            author_avatar_url=author.avatar_url if author else None,
            author_is_shop=bool(author and author.role == "merchant"),
            like_count=style_service.get_like_count(db, item.shared_style.id),
        )
    booking_invite = None
    if item.booking_invite_shop_id and item.booking_invite_shop is not None:
        booking_invite = DirectMessageBookingInviteRead(
            shop_id=item.booking_invite_shop.id,
            shop_name=item.booking_invite_shop.name,
            shop_city=item.booking_invite_shop.city,
            shop_address=item.booking_invite_shop.address,
        )
    return DirectMessageRead(
        id=item.id,
        sender_user_id=item.sender_user_id,
        recipient_user_id=item.recipient_user_id,
        content=item.content,
        image_url=item.image_url,
        shared_style=shared_style,
        booking_invite=booking_invite,
        created_at=item.created_at,
        is_mine=item.sender_user_id == current_user.id,
        read_at=item.read_at,
    )


def _message_preview(item) -> str:
    if item.content:
        return item.content
    if item.booking_invite_shop_id:
        return "[邀请预约]"
    if item.shared_style_id:
        return "[美甲]"
    if item.image_url:
        return "[图片]"
    return ""


def _serialize_thread_summary(current_user: User, item: MessageThreadSummary) -> MessageInboxThreadRead:
    preview = _message_preview(item.last_message)
    return MessageInboxThreadRead(
        target=_serialize_target(item.target),
        last_message_preview=preview,
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


@router.post("/read-all")
def mark_all_messages_as_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    return {"updated": message_service.mark_all_as_read(db, user)}


@router.get("/conversations/{target_user_id}", response_model=DirectMessageThreadRead)
def get_conversation(
    target_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageThreadRead:
    target, items, state = message_service.list_conversation(db, user, target_user_id)
    return DirectMessageThreadRead(
        target=_serialize_target(target),
        items=[_serialize_message(db, user, item) for item in items],
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
    return _serialize_message(db, user, item)


@router.post("/conversations/{target_user_id}/styles", response_model=DirectMessageRead)
def create_style_message(
    target_user_id: str,
    payload: DirectMessageStyleCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageRead:
    item = message_service.send_message(
        db,
        user,
        target_user_id,
        content=payload.content,
        shared_style_id=payload.style_id,
    )
    return _serialize_message(db, user, item)


@router.post("/conversations/{target_user_id}/booking-invites", response_model=DirectMessageRead)
def create_booking_invite_message(
    target_user_id: str,
    payload: DirectMessageBookingInviteCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageRead:
    if user.role != "merchant":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅商家可以发起邀请预约")
    target = message_service.get_target(db, user, target_user_id)
    if target.role != "consumer":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只能向用户发起预约邀请")
    shop = (
        merchant_shop_service.get_owned_shop(db, user, payload.shop_id)
        if payload.shop_id
        else merchant_shop_service.get_default_shop(db, user)
    )
    item = message_service.send_message(
        db,
        user,
        target_user_id,
        content=payload.content,
        booking_invite_shop_id=shop.id,
    )
    return _serialize_message(db, user, item)


@router.post("/conversations/{target_user_id}/tryon-results", response_model=DirectMessageRead)
def create_tryon_result_message(
    target_user_id: str,
    payload: DirectMessageTryOnResultCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageRead:
    job = db.get(TryOnJob, payload.tryon_job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="焕甲结果不存在")
    if not job.result_image_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="焕甲结果还没有生成")
    item = message_service.send_message(
        db,
        user,
        target_user_id,
        content=payload.content or "这是我的焕甲效果图，想咨询能否做这款。",
        image_url=job.result_image_url,
        shared_style_id=job.selected_style_id,
    )
    return _serialize_message(db, user, item)


@router.post("/conversations/{target_user_id}/images", response_model=DirectMessageRead)
def create_image_message(
    target_user_id: str,
    content: str = Form(default=""),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DirectMessageRead:
    settings = get_settings()
    saved_path, _ = save_user_upload_file(image, user_upload_dir(settings.upload_path, "messages", user.uid), user.uid)
    item = message_service.send_message(
        db,
        user,
        target_user_id,
        content=content,
        image_url=public_url_for_path(saved_path),
        local_image_path=relative_to_base(saved_path),
    )
    return _serialize_message(db, user, item)
