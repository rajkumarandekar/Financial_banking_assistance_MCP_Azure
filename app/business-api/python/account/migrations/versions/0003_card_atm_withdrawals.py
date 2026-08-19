"""card security settings: atm withdrawals toggle

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "account_schema"


def upgrade() -> None:
    op.add_column(
        "card_security_settings",
        sa.Column("atm_withdrawals", sa.Boolean(), nullable=False, server_default="true"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column("card_security_settings", "atm_withdrawals", schema=SCHEMA)
