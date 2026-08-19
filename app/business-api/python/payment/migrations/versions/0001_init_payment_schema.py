"""init payment_schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "payment_schema"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "payments",
        sa.Column("id", sa.String(30), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", sa.String(20), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("recipient_name", sa.String(255)),
        sa.Column("recipient_bank_code", sa.String(50)),
        sa.Column("payment_type", sa.String(50)),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("card_id", sa.String(20)),
        sa.Column("category", sa.String(100)),
        sa.Column("status", sa.String(20), nullable=False, server_default="processing"),
        sa.Column("failure_reason", sa.String(500)),
        sa.Column("transaction_id", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_payments_customer_id", "payments", ["customer_id"], schema=SCHEMA)
    op.create_index("ix_payments_account_id", "payments", ["account_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("payments", schema=SCHEMA)
