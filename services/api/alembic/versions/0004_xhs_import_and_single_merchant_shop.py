"""add XHS import metadata and single merchant shop constraint

Revision ID: 0004_xhs_import_and_single_merchant_shop
Revises: 0003_analytics_events
Create Date: 2026-05-26 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_xhs_import_and_single_merchant_shop"
down_revision = "0003_analytics_events"
branch_labels = None
depends_on = None


def _dedupe_merchant_shops() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    table_names = set(inspector.get_table_names())
    if "merchant_shops" not in table_names:
        return

    def has_column(table_name: str, column_name: str) -> bool:
        if table_name not in table_names:
            return False
        return column_name in {column["name"] for column in inspector.get_columns(table_name)}

    rows = connection.execute(
        sa.text(
            """
            SELECT id, merchant_user_id
            FROM merchant_shops
            ORDER BY merchant_user_id, is_default DESC, created_at ASC, id ASC
            """
        )
    ).mappings().all()
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(str(row["merchant_user_id"]), []).append(str(row["id"]))

    for shop_ids in grouped.values():
        keep_id, duplicate_ids = shop_ids[0], shop_ids[1:]
        if not duplicate_ids:
            connection.execute(sa.text("UPDATE merchant_shops SET is_default = TRUE WHERE id = :keep_id"), {"keep_id": keep_id})
            continue
        for duplicate_id in duplicate_ids:
            for table_name, column_name in (
                ("bookings", "shop_id"),
                ("user_posts", "shop_id"),
                ("nail_styles", "shop_id"),
                ("direct_messages", "booking_invite_shop_id"),
                ("analytics_events", "shop_id"),
            ):
                if has_column(table_name, column_name):
                    connection.execute(
                        sa.text(f"UPDATE {table_name} SET {column_name} = :keep_id WHERE {column_name} = :duplicate_id"),
                        {"keep_id": keep_id, "duplicate_id": duplicate_id},
                    )
            if "merchant_trend_claims" in table_names:
                connection.execute(
                    sa.text(
                        """
                        DELETE FROM merchant_trend_claims
                        WHERE shop_id = :duplicate_id
                          AND EXISTS (
                            SELECT 1
                            FROM merchant_trend_claims kept
                            WHERE kept.shop_id = :keep_id
                              AND kept.style_id = merchant_trend_claims.style_id
                          )
                        """
                    ),
                    {"keep_id": keep_id, "duplicate_id": duplicate_id},
                )
                connection.execute(
                    sa.text("UPDATE merchant_trend_claims SET shop_id = :keep_id WHERE shop_id = :duplicate_id"),
                    {"keep_id": keep_id, "duplicate_id": duplicate_id},
                )
            connection.execute(sa.text("DELETE FROM merchant_shops WHERE id = :duplicate_id"), {"duplicate_id": duplicate_id})
        connection.execute(sa.text("UPDATE merchant_shops SET is_default = TRUE WHERE id = :keep_id"), {"keep_id": keep_id})


def upgrade() -> None:
    op.add_column("users", sa.Column("source_type", sa.String(length=40), server_default="native", nullable=False))
    op.add_column("users", sa.Column("source_external_id", sa.String(length=160), nullable=True))
    op.create_index("ix_users_source_external_id", "users", ["source_external_id"], unique=False)
    op.create_index(
        "ix_users_source_unique",
        "users",
        ["source_type", "source_external_id"],
        unique=True,
        postgresql_where=sa.text("source_external_id IS NOT NULL"),
        sqlite_where=sa.text("source_external_id IS NOT NULL"),
    )

    op.add_column("user_posts", sa.Column("source_type", sa.String(length=50), server_default="user_upload", nullable=False))
    op.add_column("user_posts", sa.Column("source_external_id", sa.String(length=160), nullable=True))
    op.add_column("user_posts", sa.Column("source_metadata_json", sa.JSON(), server_default=sa.text("'{}'"), nullable=False))
    op.create_index("ix_user_posts_source_external_id", "user_posts", ["source_external_id"], unique=False)
    op.create_index(
        "ix_user_posts_source_unique",
        "user_posts",
        ["source_type", "source_external_id"],
        unique=True,
        postgresql_where=sa.text("source_external_id IS NOT NULL"),
        sqlite_where=sa.text("source_external_id IS NOT NULL"),
    )

    _dedupe_merchant_shops()
    op.create_index(
        "ix_merchant_shops_merchant_user_id_unique",
        "merchant_shops",
        ["merchant_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_merchant_shops_merchant_user_id_unique", table_name="merchant_shops")
    op.drop_index("ix_user_posts_source_unique", table_name="user_posts")
    op.drop_index("ix_user_posts_source_external_id", table_name="user_posts")
    op.drop_column("user_posts", "source_metadata_json")
    op.drop_column("user_posts", "source_external_id")
    op.drop_column("user_posts", "source_type")
    op.drop_index("ix_users_source_unique", table_name="users")
    op.drop_index("ix_users_source_external_id", table_name="users")
    op.drop_column("users", "source_external_id")
    op.drop_column("users", "source_type")
