import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.db.init_db import setup_database
from app.models.category import Category
from app.models.license import License
from app.models.activation import LicenseActivation
from app.services import license_service
from app.schemas.license import LicenseCreate, LicenseRenew
from app.schemas.category import CategoryCreate
from sqlalchemy.future import select
from sqlalchemy import func

async def run_tests():
    print("Starting backend logic integration tests...")
    
    # Automatically check/create DB and tables first
    await setup_database()
    
    async with AsyncSessionLocal() as db:
        # 1. Create a Category
        print("\n1. Testing Category creation...")
        cat_name = f"Test Category {os.urandom(4).hex()}"
        category = Category(name=cat_name, description="Integration test category")
        db.add(category)
        await db.commit()
        await db.refresh(category)
        assert category.id is not None
        print(f"Created category: {category.name} (ID: {category.id})")

        # 2. Bulk Generate Licenses
        print("\n2. Testing License key generation...")
        create_data = LicenseCreate(
            quantity=3,
            duration_type="days",
            duration_value=7,
            max_devices=2,
            category_id=category.id
        )
        licenses = await license_service.create_licenses(db, create_data)
        assert len(licenses) == 3
        for l in licenses:
            assert len(l.key) == 19  # XXXX-XXXX-XXXX-XXXX
            assert l.status == "new"
            assert l.activated_at is None
            assert l.expires_at is None
            print(f"Generated Key: {l.key}")
            
        target_license = licenses[0]

        # 3. Simulate Client Activation (API-like logic)
        print("\n3. Testing Client Activation...")
        # First activation of this key
        # Simulate router activate logic
        # Retrieve key
        result = await db.execute(select(License).where(License.key == target_license.key))
        license_obj = result.scalars().first()
        assert license_obj is not None
        
        # Check active devices
        act_res = await db.execute(select(LicenseActivation).where(LicenseActivation.license_id == license_obj.id))
        activations = act_res.scalars().all()
        assert len(activations) == 0
        
        # Perform activation for device 1
        now = license_service.now_vn()
        license_obj.activated_at = now
        license_obj.status = "active"
        license_obj.expires_at = now + delta_calc(license_obj.duration_type, license_obj.duration_value)
        db.add(license_obj)
        
        new_act = LicenseActivation(
            license_id=license_obj.id,
            device_id="device-pc-01",
            device_name="Workstation 1",
            os_info="Windows 11",
            app_version="1.0.0",
            activated_at=now,
            last_checked_at=now
        )
        db.add(new_act)
        await db.commit()
        print("Device 1 activated successfully.")

        # Refresh
        await db.refresh(license_obj)
        assert license_obj.status == "active"
        assert license_obj.expires_at is not None
        assert license_obj.activated_at is not None
        
        # Activate device 2 (new device, within max_devices=2)
        new_act_2 = LicenseActivation(
            license_id=license_obj.id,
            device_id="device-pc-02",
            device_name="Laptop 1",
            os_info="Windows 10",
            app_version="1.0.0",
            activated_at=now,
            last_checked_at=now
        )
        db.add(new_act_2)
        await db.commit()
        print("Device 2 activated successfully.")

        # Try to activate device 3 (exceed limit)
        act_count_res = await db.execute(select(func.count(LicenseActivation.id)).where(LicenseActivation.license_id == license_obj.id))
        active_count = act_count_res.scalar() or 0
        print(f"Current active devices count: {active_count} (Max: {license_obj.max_devices})")
        assert active_count == 2
        
        if active_count >= license_obj.max_devices:
            print("Device 3 activation prevented correctly (exceeded limit).")
        else:
            raise AssertionError("Should have blocked device 3")

        # 4. Testing License Renewal
        print("\n4. Testing Renewal...")
        renew_data = LicenseRenew(duration_type="months", duration_value=1)
        original_expires_at = license_obj.expires_at
        renewed_license = await license_service.renew_license(db, license_obj.id, renew_data)
        assert renewed_license.expires_at > original_expires_at
        print(f"Renewed successfully. Old expiry: {original_expires_at}, New expiry: {renewed_license.expires_at}")

        # 5. Testing Revocation
        print("\n5. Testing Revocation...")
        revoked_license = await license_service.revoke_license(db, license_obj.id)
        assert revoked_license.status == "revoked"
        print("License key status updated to: revoked")

    print("\nAll integration tests passed successfully!")

def delta_calc(duration_type, duration_value):
    from datetime import timedelta
    days = 0
    if duration_type == "days":
        days = duration_value
    elif duration_type == "months":
        days = duration_value * 30
    elif duration_type == "years":
        days = duration_value * 365
    return timedelta(days=days)

if __name__ == "__main__":
    asyncio.run(run_tests())
