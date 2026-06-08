import secrets
import string
import uuid
from datetime import timedelta
from typing import List, Optional, Tuple
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import now_vn, to_vn_tz
from app.models.license import License
from app.models.category import Category
from app.models.activation import LicenseActivation
from app.schemas.license import LicenseCreate, LicenseRenew

def generate_key_chunk() -> str:
    """Generate a 4-character uppercase alphanumeric chunk."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(4))

def generate_license_key() -> str:
    """Generate a 16-character license key formatted as XXXX-XXXX-XXXX-XXXX."""
    return f"{generate_key_chunk()}-{generate_key_chunk()}-{generate_key_chunk()}-{generate_key_chunk()}"

async def generate_unique_key(db: AsyncSession) -> str:
    """Generate a license key and ensure it is unique in the database."""
    while True:
        key = generate_license_key()
        result = await db.execute(select(License).filter_by(key=key))
        if not result.scalars().first():
            return key

async def sync_expired_licenses(db: AsyncSession) -> None:
    """Update status of all active licenses that have passed their expiration time."""
    now = now_vn()
    # Update active keys where expires_at has passed and not lifetime
    stmt = (
        update(License)
        .where(
            License.status == "active",
            License.is_lifetime == False,
            License.expires_at < now
        )
        .values(status="expired", updated_at=now)
        .execution_options(synchronize_session=False)
    )
    await db.execute(stmt)
    await db.commit()

async def create_licenses(db: AsyncSession, data: LicenseCreate) -> List[License]:
    """Bulk create license keys."""
    # Check if category exists
    category_res = await db.execute(select(Category).filter_by(id=data.category_id))
    category = category_res.scalars().first()
    if not category:
        raise ValueError("Category not found")

    licenses = []
    generated_keys: set[str] = set()
    is_lifetime = data.duration_type == "lifetime"

    for _ in range(data.quantity):
        key = await generate_unique_key(db)
        while key in generated_keys:
            key = await generate_unique_key(db)
        generated_keys.add(key)
        license_obj = License(
            key=key,
            category_id=data.category_id,
            duration_type=data.duration_type,
            duration_value=data.duration_value,
            max_devices=data.max_devices,
            is_lifetime=is_lifetime,
            status="new",
            created_at=now_vn(),
            updated_at=now_vn()
        )
        db.add(license_obj)
        licenses.append(license_obj)

    await db.commit()
    
    # Refresh objects to ensure they are loaded
    for l in licenses:
        await db.refresh(l)
    return licenses

async def get_licenses_list(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None
) -> Tuple[List[dict], int]:
    """Retrieve filtered, paginated list of licenses with category names and device counts."""
    # Sync expired status first
    await sync_expired_licenses(db)

    # Base query for licenses
    # Using group_by to aggregate license activation count
    query = (
        select(
            License,
            Category.name.label("category_name"),
            func.count(LicenseActivation.id).label("devices_count")
        )
        .join(Category, License.category_id == Category.id)
        .outerjoin(LicenseActivation, License.id == LicenseActivation.license_id)
        .group_by(License.id, Category.name)
    )

    # Apply filters
    if search:
        query = query.where(License.key.icontains(search))
    if category_id:
        query = query.where(License.category_id == category_id)
    if status:
        if status == "lifetime":
            query = query.where(License.is_lifetime.is_(True))
        else:
            query = query.where(License.status == status)

    # Order by newest
    query = query.order_by(License.created_at.desc())

    # Get total count using subquery
    subq = query.subquery()
    count_query = select(func.count()).select_from(subq)
    count_res = await db.execute(count_query)
    total_count = count_res.scalar() or 0

    # Paginate
    query = query.limit(page_size).offset((page - 1) * page_size)
    res = await db.execute(query)
    rows = res.all()

    licenses_data = []
    for row in rows:
        license_obj, cat_name, dev_count = row
        licenses_data.append({
            "id": license_obj.id,
            "key": license_obj.key,
            "category_id": license_obj.category_id,
            "category_name": cat_name,
            "duration_type": license_obj.duration_type,
            "duration_value": license_obj.duration_value,
            "max_devices": license_obj.max_devices,
            "activated_at": license_obj.activated_at,
            "expires_at": license_obj.expires_at,
            "is_lifetime": license_obj.is_lifetime,
            "status": license_obj.status,
            "created_at": license_obj.created_at,
            "updated_at": license_obj.updated_at,
            "devices_count": dev_count
        })

    return licenses_data, total_count

async def renew_license(db: AsyncSession, license_id: uuid.UUID, data: LicenseRenew) -> License:
    """Renew a license key adding duration or setting to lifetime."""
    # Sync expired licenses first
    await sync_expired_licenses(db)
    
    result = await db.execute(
        select(License).where(License.id == license_id)
    )
    license_obj = result.scalars().first()
    if not license_obj:
        raise ValueError("License key not found")
        
    if license_obj.status == "revoked":
        raise ValueError("Cannot renew a revoked license key")

    now = now_vn()
    is_lifetime = data.duration_type == "lifetime"
    
    # Update duration metadata
    license_obj.duration_type = data.duration_type
    license_obj.duration_value = data.duration_value
    license_obj.is_lifetime = is_lifetime
    license_obj.updated_at = now

    # Calculation logic for active or expired keys:
    if license_obj.status == "new":
        # Key not active yet: only update duration type/value. expires_at remains NULL.
        pass
    else:
        # Key is active or expired
        if is_lifetime:
            license_obj.expires_at = None
            license_obj.status = "active"
        else:
            # Map duration increments
            days = 0
            if data.duration_type == "days":
                days = data.duration_value
            elif data.duration_type == "months":
                days = data.duration_value * 30  # approximate
            elif data.duration_type == "years":
                days = data.duration_value * 365
                
            delta = timedelta(days=days)

            if license_obj.status == "expired" or license_obj.expires_at is None:
                # If expired, calculate starting from NOW
                license_obj.expires_at = now + delta
            else:
                # If active, append to current expires_at
                license_obj.expires_at = to_vn_tz(license_obj.expires_at) + delta
                
            license_obj.status = "active"

    db.add(license_obj)
    await db.commit()
    await db.refresh(license_obj)
    return license_obj

async def revoke_license(db: AsyncSession, license_id: uuid.UUID) -> License:
    """Soft delete/revoke a license key."""
    result = await db.execute(
        select(License).where(License.id == license_id)
    )
    license_obj = result.scalars().first()
    if not license_obj:
        raise ValueError("License key not found")

    license_obj.status = "revoked"
    license_obj.updated_at = now_vn()
    db.add(license_obj)
    await db.commit()
    await db.refresh(license_obj)
    return license_obj

async def delete_revoked_license(db: AsyncSession, license_id: uuid.UUID) -> None:
    """Permanently delete a revoked license key."""
    result = await db.execute(
        select(License).where(License.id == license_id)
    )
    license_obj = result.scalars().first()
    if not license_obj:
        raise ValueError("License key not found")
    if license_obj.status != "revoked":
        raise ValueError("Only revoked license keys can be permanently deleted")

    await db.delete(license_obj)
    await db.commit()
