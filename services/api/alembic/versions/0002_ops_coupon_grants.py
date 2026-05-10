"""add ops coupon grants

Revision ID: 0002_ops_coupon_grants
Revises: 0001_initial
Create Date: 2026-05-09 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_ops_coupon_grants"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ops_coupon_grants",
        sa.Column("target_type", sa.String(length=30), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("coupon_name", sa.String(length=120), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_until", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=80), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ops_coupon_grants_target_id"), "ops_coupon_grants", ["target_id"], unique=False)
    op.create_index(op.f("ix_ops_coupon_grants_target_type"), "ops_coupon_grants", ["target_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ops_coupon_grants_target_type"), table_name="ops_coupon_grants")
    op.drop_index(op.f("ix_ops_coupon_grants_target_id"), table_name="ops_coupon_grants")
    op.drop_table("ops_coupon_grants")
