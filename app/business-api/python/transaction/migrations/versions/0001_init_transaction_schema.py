"""init transaction_schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "transaction_schema"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "transactions",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("account_id", sa.String(20), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("type", sa.String(20)),
        sa.Column("flow_type", sa.String(10)),
        sa.Column("recipient_name", sa.String(255)),
        sa.Column("recipient_bank_reference", sa.String(100)),
        sa.Column("payment_type", sa.String(50)),
        sa.Column("amount", sa.Numeric(18, 2)),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("card_id", sa.String(20)),
        sa.Column("category", sa.String(100)),
        sa.Column("status", sa.String(20)),
        schema=SCHEMA,
    )
    op.create_index("ix_transactions_account_id", "transactions", ["account_id"], schema=SCHEMA)
    op.create_index("ix_transactions_timestamp", "transactions", ["timestamp"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("transactions", schema=SCHEMA)
