"""initial schema

Revision ID: 0001_initial
Revises: None
Create Date: 2026-04-23 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("uid", sa.Integer(), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("birthday", sa.String(length=20), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("last_login_ip_location", sa.String(length=120), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_uid", "users", ["uid"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "nail_styles",
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(length=512), nullable=False),
        sa.Column("local_image_path", sa.String(length=512), nullable=False),
        sa.Column("original_image_url", sa.String(length=512), nullable=True),
        sa.Column("enhanced_image_url", sa.String(length=512), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("tags_json", sa.JSON(), nullable=False),
        sa.Column("dominant_colors_json", sa.JSON(), nullable=False),
        sa.Column("style_metadata_json", sa.JSON(), nullable=False),
        sa.Column("popularity_score", sa.Float(), nullable=False),
        sa.Column("is_trending", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ops_reports",
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("markdown_content", sa.Text(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("report_json", sa.JSON(), nullable=False),
        sa.Column("local_file_path", sa.String(length=512), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_date"),
    )

    op.create_table(
        "trend_snapshots",
        sa.Column("source_name", sa.String(length=100), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("raw_count", sa.Integer(), nullable=False),
        sa.Column("valid_count", sa.Integer(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "job_logs",
        sa.Column("job_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_posts",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(length=512), nullable=False),
        sa.Column("local_image_path", sa.String(length=512), nullable=False),
        sa.Column("tags_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_favorites",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("nail_style_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["nail_style_id"], ["nail_styles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "nail_style_id", name="uq_user_favorite_style"),
    )

    op.create_table(
        "tryon_jobs",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source_hand_image_url", sa.String(length=512), nullable=True),
        sa.Column("hand_image_path", sa.String(length=512), nullable=False),
        sa.Column("selected_style_id", sa.String(length=36), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("result_image_path", sa.String(length=512), nullable=True),
        sa.Column("result_image_url", sa.String(length=512), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["selected_style_id"], ["nail_styles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "style_events_daily",
        sa.Column("style_id", sa.String(length=36), nullable=False),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("impressions", sa.Integer(), nullable=False),
        sa.Column("clicks", sa.Integer(), nullable=False),
        sa.Column("favorites", sa.Integer(), nullable=False),
        sa.Column("tryons", sa.Integer(), nullable=False),
        sa.Column("publishes", sa.Integer(), nullable=False),
        sa.Column("ctr", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["style_id"], ["nail_styles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("style_id", "stat_date", name="uq_style_daily"),
    )


def downgrade() -> None:
    op.drop_table("style_events_daily")
    op.drop_table("tryon_jobs")
    op.drop_table("user_favorites")
    op.drop_table("user_posts")
    op.drop_table("job_logs")
    op.drop_table("trend_snapshots")
    op.drop_table("ops_reports")
    op.drop_table("nail_styles")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_uid", table_name="users")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")
