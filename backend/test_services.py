import asyncio
import os
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from fastapi import HTTPException

# Allow running this file directly from the backend directory.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.api.routes.activations import activate_license, check_license
from app.api.routes.auth import change_password, login
from app.api.routes.categories import delete_category
from app.api.routes.licenses import (
    create_licenses,
    delete_revoked_license,
    get_license_activations,
    get_license_stats,
    get_licenses,
    renew_license,
    revoke_license,
)
from app.db.base import Base
from app.models.activation import LicenseActivation
from app.models.admin import Admin
from app.models.category import Category
from app.models.license import License
from app.schemas.activation import ClientActivateRequest, ClientCheckRequest
from app.schemas.auth import ChangePasswordSchema, LoginSchema
from app.schemas.license import LicenseCreate, LicenseRenew
from app.core.config import settings
from app.core.security import get_password_hash


async def run_tests() -> None:
    """Run the complete license flow without touching the configured database."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        admin = Admin(username="integration-admin", password_hash=get_password_hash("InitialPassword123"))
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        token = await login(LoginSchema(username=admin.username, password="InitialPassword123"), db)
        assert token.access_token

        try:
            await login(LoginSchema(username=admin.username, password="wrong-password"), db)
            raise AssertionError("Invalid password was accepted")
        except HTTPException as exc:
            assert exc.status_code == 401

        await change_password(
            ChangePasswordSchema(
                old_password="InitialPassword123",
                new_password="UpdatedPassword123",
                auth_code=settings.PASSWORD_CHANGE_AUTH_CODE,
            ),
            admin,
            db,
        )
        updated_token = await login(LoginSchema(username=admin.username, password="UpdatedPassword123"), db)
        assert updated_token.access_token

        category = Category(name="Integration Test", description="Temporary test category")
        db.add(category)
        await db.commit()
        await db.refresh(category)

        created = await create_licenses(
            LicenseCreate(
                quantity=3,
                duration_type="days",
                duration_value=7,
                max_devices=2,
                category_id=category.id,
            ),
            db,
            None,
        )
        assert len(created) == 3
        assert len({license_item.key for license_item in created}) == 3
        assert all(item.status == "new" for item in created)
        assert all(item.activated_at is None and item.expires_at is None for item in created)

        target = created[0]
        first_activation = await activate_license(
            ClientActivateRequest(
                license_key=f"  {target.key.lower()}  ",
                device_id=" device-01 ",
                category="Integration Test",
                device_name="Workstation",
            ),
            db,
        )
        assert first_activation.status == "valid"
        assert first_activation.active_devices == 1
        assert first_activation.expires_at is not None

        # Test activation with incorrect category
        incorrect_cat_activation = await activate_license(
            ClientActivateRequest(license_key=target.key, device_id="device-01", category="Incorrect Category"),
            db,
        )
        assert incorrect_cat_activation.status == "invalid"

        repeated_activation = await activate_license(
            ClientActivateRequest(license_key=target.key, device_id="device-01", category="Integration Test"),
            db,
        )
        assert repeated_activation.status == "valid"
        assert repeated_activation.active_devices == 1

        second_activation = await activate_license(
            ClientActivateRequest(license_key=target.key, device_id="device-02", category="Integration Test"),
            db,
        )
        assert second_activation.status == "valid"
        assert second_activation.active_devices == 2

        device_limit = await activate_license(
            ClientActivateRequest(license_key=target.key, device_id="device-03", category="Integration Test"),
            db,
        )
        assert device_limit.status == "device_limit_exceeded"

        valid_check = await check_license(
            ClientCheckRequest(license_key=target.key, device_id="device-01", category="Integration Test"),
            db,
        )
        assert valid_check.status == "valid"

        # Test check with incorrect category
        incorrect_cat_check = await check_license(
            ClientCheckRequest(license_key=target.key, device_id="device-01", category="Incorrect Category"),
            db,
        )
        assert incorrect_cat_check.status == "invalid"

        unknown_device_check = await check_license(
            ClientCheckRequest(license_key=target.key, device_id="unknown-device", category="Integration Test"),
            db,
        )
        assert unknown_device_check.status == "device_not_activated"

        renewed = await renew_license(
            target.id,
            LicenseRenew(duration_type="months", duration_value=1),
            db,
            None,
        )
        assert renewed.status == "active"
        assert renewed.devices_count == 2

        activations = await get_license_activations(target.id, db, None)
        assert len(activations) == 2

        lifetime_created = await create_licenses(
            LicenseCreate(
                quantity=1,
                duration_type="lifetime",
                max_devices=1,
                category_id=category.id,
            ),
            db,
            None,
        )
        lifetime_list = await get_licenses(1, 20, None, None, "lifetime", db, None)
        assert lifetime_list["total"] == 1
        assert lifetime_list["items"][0]["id"] == lifetime_created[0].id

        stats = await get_license_stats(db, None)
        assert stats["active"] == 1
        assert stats["total_activations"] == 2

        await revoke_license(target.id, db, None)
        revoked_activation = await activate_license(
            ClientActivateRequest(license_key=target.key, device_id="device-01", category="Integration Test"),
            db,
        )
        assert revoked_activation.status == "revoked"

        await delete_revoked_license(target.id, db, None)
        assert await db.scalar(select(License).where(License.id == target.id)) is None
        assert await db.scalar(
            select(LicenseActivation).where(LicenseActivation.license_id == target.id)
        ) is None

        # Try to delete category with incorrect security code
        try:
            await delete_category(category.id, auth_code="wrong_code", db=db, current_admin=admin)
            raise AssertionError("Category delete accepted incorrect auth code")
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "Incorrect security code" in exc.detail

        # Try to delete category while licenses exist
        try:
            await delete_category(category.id, auth_code=settings.PASSWORD_CHANGE_AUTH_CODE, db=db, current_admin=admin)
            raise AssertionError("Category delete allowed with associated licenses")
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "associated license keys" in exc.detail

        # Clean up remaining licenses under category
        from sqlalchemy import delete
        await db.execute(delete(License))
        await db.commit()

        # Delete category with correct code
        del_resp = await delete_category(category.id, auth_code=settings.PASSWORD_CHANGE_AUTH_CODE, db=db, current_admin=admin)
        assert del_resp["status"] == "success"
        assert await db.scalar(select(Category).where(Category.id == category.id)) is None

    await engine.dispose()
    print("All backend integration tests passed successfully.")


if __name__ == "__main__":
    asyncio.run(run_tests())
