"""init credit_schema

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

SCHEMA = "credit_schema"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "credit_scores",
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("rating", sa.String(20), nullable=False),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )

    op.create_table(
        "credit_history",
        sa.Column("id", sa.String(30), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("impact", sa.String(10), nullable=False, server_default="neutral"),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_credit_history_customer_id", "credit_history", ["customer_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("credit_history", schema=SCHEMA)
    op.drop_table("credit_scores", schema=SCHEMA)
