"""init account_schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "account_schema"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "accounts",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_name", sa.String(255), nullable=False),
        sa.Column("account_holder_full_name", sa.String(255), nullable=False),
        sa.Column("currency", sa.CHAR(3), nullable=False),
        sa.Column("activation_date", sa.Date(), nullable=False),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_accounts_customer_id", "accounts", ["customer_id"], schema=SCHEMA)
    op.create_index("ix_accounts_user_name", "accounts", ["user_name"], schema=SCHEMA)

    op.create_table(
        "payment_methods",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column(
            "account_id",
            sa.String(20),
            sa.ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("activation_date", sa.Date()),
        sa.Column("expiration_date", sa.Date()),
        sa.Column("available_balance", sa.Numeric(18, 2)),
        sa.Column("card_number", sa.String(32)),
        sa.Column("status", sa.String(20)),
        schema=SCHEMA,
    )
    op.create_index("ix_payment_methods_account_id", "payment_methods", ["account_id"], schema=SCHEMA)

    op.create_table(
        "cards",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column(
            "account_id",
            sa.String(20),
            sa.ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("circuit", sa.String(20)),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("activation_date", sa.Date()),
        sa.Column("expiration_date", sa.Date()),
        sa.Column("balance", sa.Numeric(18, 2), server_default="0"),
        sa.Column("recharged_amount", sa.Numeric(18, 2)),
        sa.Column("number", sa.String(32)),
        sa.Column("limit_amount", sa.Numeric(18, 2)),
        sa.Column("status", sa.String(20)),
        sa.Column("cvv", sa.String(4)),
        schema=SCHEMA,
    )
    op.create_index("ix_cards_account_id", "cards", ["account_id"], schema=SCHEMA)

    op.create_table(
        "beneficiaries",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column(
            "account_id",
            sa.String(20),
            sa.ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("bank_code", sa.String(50), nullable=False),
        sa.Column("bank_name", sa.String(255), nullable=False),
        schema=SCHEMA,
    )
    op.create_index("ix_beneficiaries_account_id", "beneficiaries", ["account_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("beneficiaries", schema=SCHEMA)
    op.drop_table("cards", schema=SCHEMA)
    op.drop_table("payment_methods", schema=SCHEMA)
    op.drop_table("accounts", schema=SCHEMA)
