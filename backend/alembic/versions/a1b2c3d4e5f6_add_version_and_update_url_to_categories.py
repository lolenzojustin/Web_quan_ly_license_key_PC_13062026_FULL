"""add version and update_url to categories

Revision ID: a1b2c3d4e5f6
Revises: fd5f96219002
Create Date: 2026-06-13 09:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fd5f96219002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('categories', sa.Column('version', sa.String(50), nullable=True))
    op.add_column('categories', sa.Column('update_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('categories', 'update_url')
    op.drop_column('categories', 'version')
