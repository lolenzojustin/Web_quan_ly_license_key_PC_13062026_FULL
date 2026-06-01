import asyncio
import sys
import os

# Add backend directory to sys.path so we can run this script directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.future import select
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.admin import Admin

async def seed_db() -> None:
    async with AsyncSessionLocal() as session:
        # Check if admin already exists
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

if __name__ == "__main__":
    asyncio.run(seed_db())
