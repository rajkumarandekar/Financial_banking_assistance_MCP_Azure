"""card management: frozen flag, security settings, limit increase requests

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "account_schema"


def upgrade() -> None:
    op.add_column("cards", sa.Column("frozen", sa.Boolean(), nullable=False, server_default="false"), schema=SCHEMA)

    op.create_table(
        "card_security_settings",
        sa.Column("card_id", sa.String(20), sa.ForeignKey(f"{SCHEMA}.cards.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("online_transactions", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("international_transactions", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("contactless_payments", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("daily_transaction_limit", sa.Numeric(18, 2), nullable=False, server_default="50000"),
        sa.Column("daily_online_limit", sa.Numeric(18, 2), nullable=False, server_default="25000"),
        schema=SCHEMA,
    )

    op.create_table(
        "card_limit_requests",
        sa.Column("id", sa.String(30), primary_key=True),
        sa.Column("card_id", sa.String(20), sa.ForeignKey(f"{SCHEMA}.cards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_limit", sa.Numeric(18, 2), nullable=False),
        sa.Column("requested_limit", sa.Numeric(18, 2), nullable=False),
        # under_review | approved | rejected
        sa.Column("status", sa.String(20), nullable=False, server_default="under_review"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_card_limit_requests_card_id", "card_limit_requests", ["card_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("card_limit_requests", schema=SCHEMA)
    op.drop_table("card_security_settings", schema=SCHEMA)
    op.drop_column("cards", "frozen", schema=SCHEMA)
