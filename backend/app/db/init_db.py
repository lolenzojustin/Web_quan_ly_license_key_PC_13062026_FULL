import asyncio
import asyncpg
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy.future import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.admin import Admin

async def check_and_create_db() -> None:
    """Check if the target PostgreSQL database exists. If not, create it."""
    if not settings.DATABASE_URL.startswith("postgresql"):
        # SQLite creates the file automatically, so we don't need this check
        return

    # Extract db name and base connection URL from settings.DATABASE_URL
    # e.g., postgresql+asyncpg://postgres:Thang123456@localhost:5432/license_manager
    url = settings.DATABASE_URL
    last_slash_idx = url.rfind("/")
    if last_slash_idx == -1:
        return
        
    db_name = url[last_slash_idx + 1:]
    base_url = url[:last_slash_idx + 1] + "postgres"
    
    # Convert postgresql+asyncpg:// to standard postgresql:// for asyncpg connection
    asyncpg_url = base_url.replace("postgresql+asyncpg://", "postgresql://")
    
    try:
        conn = await asyncpg.connect(asyncpg_url)
        # Check if target database exists in pg_database catalog
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )
        if not exists:
            print(f"Database '{db_name}' does not exist. Creating...")
            # Run CREATE DATABASE outside a transaction (standard asyncpg behavior is no transaction by default)
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"Database '{db_name}' created successfully.")
        else:
            print(f"Database '{db_name}' already exists.")
        await conn.close()
    except Exception as e:
        print(f"Warning during database check/creation: {e}")

async def run_migrations() -> None:
    """Upgrade the configured database to the latest Alembic revision."""
    alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
    alembic_config = Config(str(alembic_ini))
    await asyncio.to_thread(command.upgrade, alembic_config, "head")

async def seed_admin() -> None:
    """Seed the default admin account if it does not already exist."""
    print("Checking default admin...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Admin).filter_by(username=settings.INITIAL_ADMIN_USERNAME)
        )
        admin = result.scalars().first()
        if not admin:
            print(f"Seeding default admin: {settings.INITIAL_ADMIN_USERNAME}")
            hashed_password = get_password_hash(settings.INITIAL_ADMIN_PASSWORD)
            new_admin = Admin(
                username=settings.INITIAL_ADMIN_USERNAME,
                password_hash=hashed_password
            )
            session.add(new_admin)
            await session.commit()
            print("Default admin seeded successfully.")
        else:
            print(f"Admin '{settings.INITIAL_ADMIN_USERNAME}' already exists. Skipping seed.")

async def setup_database() -> None:
    """Perform full database setup sequence: check DB, create tables, and seed admin."""
    await check_and_create_db()
    await run_migrations()
    await seed_admin()
