"""add analytics events

Revision ID: 0003_analytics_events
Revises: 0002_ops_coupon_grants
Create Date: 2026-05-21 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_analytics_events"
down_revision = "0002_ops_coupon_grants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("event_id", sa.String(length=80), nullable=False),
        sa.Column("event_name", sa.String(length=80), nullable=False),
        sa.Column("anonymous_id", sa.String(length=80), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("session_id", sa.String(length=80), nullable=True),
        sa.Column("style_id", sa.String(length=36), nullable=True),
        sa.Column("tryon_job_id", sa.String(length=36), nullable=True),
        sa.Column("booking_id", sa.String(length=36), nullable=True),
        sa.Column("shop_id", sa.String(length=36), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("screen", sa.String(length=80), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=True),
        sa.Column("properties_json", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shop_id"], ["merchant_shops.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["style_id"], ["nail_styles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tryon_job_id"], ["tryon_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_analytics_events_event_id"),
    )
    for column in ["event_id", "event_name", "anonymous_id", "user_id", "session_id", "style_id", "tryon_job_id", "booking_id", "shop_id", "occurred_at"]:
        op.create_index(f"ix_analytics_events_{column}", "analytics_events", [column], unique=False)

    op.create_table(
        "analytics_identity_links",
        sa.Column("anonymous_id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("anonymous_id", "user_id", name="uq_analytics_identity_link"),
    )
    op.create_index("ix_analytics_identity_links_anonymous_id", "analytics_identity_links", ["anonymous_id"], unique=False)
    op.create_index("ix_analytics_identity_links_user_id", "analytics_identity_links", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_analytics_identity_links_user_id", table_name="analytics_identity_links")
    op.drop_index("ix_analytics_identity_links_anonymous_id", table_name="analytics_identity_links")
    op.drop_table("analytics_identity_links")
    for column in reversed(["event_id", "event_name", "anonymous_id", "user_id", "session_id", "style_id", "tryon_job_id", "booking_id", "shop_id", "occurred_at"]):
        op.drop_index(f"ix_analytics_events_{column}", table_name="analytics_events")
    op.drop_table("analytics_events")
