"""init loan_schema

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

SCHEMA = "loan_schema"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "loans",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", sa.String(20)),
        sa.Column("loan_type", sa.String(50), nullable=False),
        sa.Column("principal_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("tenure_months", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("applied_date", sa.Date, nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("decision_date", sa.Date),
        sa.Column("rejection_reason", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_loans_customer_id", "loans", ["customer_id"], schema=SCHEMA)

    op.create_table(
        "emi_schedule",
        sa.Column("id", sa.String(30), primary_key=True),
        sa.Column(
            "loan_id", sa.String(20), sa.ForeignKey(f"{SCHEMA}.loans.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("installment_number", sa.Integer, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        schema=SCHEMA,
    )
    op.create_index("ix_emi_schedule_loan_id", "emi_schedule", ["loan_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("emi_schedule", schema=SCHEMA)
    op.drop_table("loans", schema=SCHEMA)
