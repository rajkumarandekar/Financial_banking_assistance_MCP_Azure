"""init investment_schema

Revision ID: 0001
Revises:
Create Date: 2026-08-17

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

SCHEMA = "investment_schema"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "stock_prices",
        sa.Column("symbol", sa.String(20), primary_key=True),
        sa.Column("exchange_symbol", sa.String(30), nullable=False),
        sa.Column("company_name", sa.String(255)),
        sa.Column("price", sa.Numeric(18, 2)),
        sa.Column("change", sa.Numeric(18, 2)),
        sa.Column("change_percent", sa.Numeric(8, 2)),
        sa.Column("volume", sa.BigInteger()),
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.String(500)),
        schema=SCHEMA,
    )

    op.create_table(
        "holdings",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", sa.String(20)),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("sector", sa.String(100)),
        sa.Column("shares", sa.Numeric(18, 4), nullable=False),
        sa.Column("avg_purchase_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_holdings_customer_id", "holdings", ["customer_id"], schema=SCHEMA)
    op.create_index("ix_holdings_symbol", "holdings", ["symbol"], schema=SCHEMA)

    op.create_table(
        "stock_transactions",
        sa.Column("id", sa.String(30), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", sa.String(20)),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("shares", sa.Numeric(18, 4), nullable=False),
        sa.Column("price", sa.Numeric(18, 2), nullable=False),
        sa.Column("total", sa.Numeric(18, 2), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_stock_transactions_customer_id", "stock_transactions", ["customer_id"], schema=SCHEMA)
    op.create_index("ix_stock_transactions_symbol", "stock_transactions", ["symbol"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("stock_transactions", schema=SCHEMA)
    op.drop_table("holdings", schema=SCHEMA)
    op.drop_table("stock_prices", schema=SCHEMA)
