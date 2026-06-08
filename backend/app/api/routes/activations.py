from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.timezone import now_vn, to_vn_tz
from app.models.license import License
from app.models.activation import LicenseActivation
from app.schemas.activation import (
    ClientActivateRequest,
    ClientActivateResponse,
    ClientCheckRequest,
    ClientCheckResponse,
)

router = APIRouter()

@router.post("/activate", response_model=ClientActivateResponse)
async def activate_license(
    data: ClientActivateRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Activate a license key for a client PC device.
    """
    # 1. Retrieve the license key and its category
    result = await db.execute(
        select(License)
        .where(License.key == data.license_key)
        .options(selectinload(License.category))
        .with_for_update()
    )
    license_obj = result.scalars().first()
    
    category_matches = False
    if license_obj and license_obj.category:
        category_matches = (
            license_obj.category.name.strip().lower() == data.category.strip().lower()
            or str(license_obj.category.id).strip().lower() == data.category.strip().lower()
        )
    
    if not license_obj or not category_matches:
        return ClientActivateResponse(
            status="invalid",
            license_key=data.license_key,
            is_lifetime=False,
            max_devices=0,
            active_devices=0
        )
        
    if license_obj.status == "revoked":
        return ClientActivateResponse(
            status="revoked",
            license_key=license_obj.key,
            is_lifetime=license_obj.is_lifetime,
            max_devices=license_obj.max_devices,
            active_devices=0
        )
        
    now = now_vn()
    
    # 2. Check if the key has expired
    if license_obj.status == "active" and not license_obj.is_lifetime and license_obj.expires_at:
        if now > to_vn_tz(license_obj.expires_at):
            license_obj.status = "expired"
            license_obj.updated_at = now
            db.add(license_obj)
            await db.commit()
            
    if license_obj.status == "expired":
        return ClientActivateResponse(
            status="expired",
            license_key=license_obj.key,
            is_lifetime=license_obj.is_lifetime,
            max_devices=license_obj.max_devices,
            active_devices=0
        )

    # 3. Check current activation list and device count
    existing_act = await db.scalar(
        select(LicenseActivation).where(
            LicenseActivation.license_id == license_obj.id,
            LicenseActivation.device_id == data.device_id,
        )
    )
    active_devices = await db.scalar(
        select(func.count(LicenseActivation.id)).where(
            LicenseActivation.license_id == license_obj.id
        )
    ) or 0

    if existing_act:
        # Device already registered: update checking time and return success
        existing_act.last_checked_at = now
        # Keep details updated
        if data.device_name:
            existing_act.device_name = data.device_name
        if data.os_info:
            existing_act.os_info = data.os_info
        if data.app_version:
            existing_act.app_version = data.app_version
            
        db.add(existing_act)
        await db.commit()
        
        return ClientActivateResponse(
            status="valid",
            license_key=license_obj.key,
            activated_at=license_obj.activated_at,
            expires_at=license_obj.expires_at,
            is_lifetime=license_obj.is_lifetime,
            max_devices=license_obj.max_devices,
            active_devices=active_devices
        )

    # 4. If device is new, verify limit
    if active_devices >= license_obj.max_devices:
        return ClientActivateResponse(
            status="device_limit_exceeded",
            license_key=license_obj.key,
            is_lifetime=license_obj.is_lifetime,
            max_devices=license_obj.max_devices,
            active_devices=active_devices
        )

    # 5. Perform first activation if status is new
    if license_obj.status == "new":
        license_obj.activated_at = now
        license_obj.status = "active"
        
        # Calculate expiration
        if not license_obj.is_lifetime:
            days = 0
            if license_obj.duration_type == "days":
                days = license_obj.duration_value
            elif license_obj.duration_type == "months":
                days = license_obj.duration_value * 30
            elif license_obj.duration_type == "years":
                days = license_obj.duration_value * 365
            
            license_obj.expires_at = now + timedelta(days=days)
            
        license_obj.updated_at = now
        db.add(license_obj)

    # 6. Add activation entry
    new_activation = LicenseActivation(
        license_id=license_obj.id,
        device_id=data.device_id,
        device_name=data.device_name,
        os_info=data.os_info,
        app_version=data.app_version,
        activated_at=now,
        last_checked_at=now
    )
    db.add(new_activation)
    await db.commit()

    # Get updated active devices count
    active_devices += 1

    return ClientActivateResponse(
        status="valid",
        license_key=license_obj.key,
        activated_at=license_obj.activated_at,
        expires_at=license_obj.expires_at,
        is_lifetime=license_obj.is_lifetime,
        max_devices=license_obj.max_devices,
        active_devices=active_devices
    )

@router.post("/check", response_model=ClientCheckResponse)
async def check_license(
    data: ClientCheckRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Check the validity of a license key for a specific device.
    """
    # 1. Retrieve the license key and its category
    result = await db.execute(
        select(License)
        .where(License.key == data.license_key)
        .options(selectinload(License.category))
    )
    license_obj = result.scalars().first()
    
    now = now_vn()

    category_matches = False
    if license_obj and license_obj.category:
        category_matches = (
            license_obj.category.name.strip().lower() == data.category.strip().lower()
            or str(license_obj.category.id).strip().lower() == data.category.strip().lower()
        )

    if not license_obj or not category_matches:
        return ClientCheckResponse(status="invalid", server_time=now)
        
    if license_obj.status == "revoked":
        return ClientCheckResponse(status="revoked", server_time=now)

    # 2. Check if the device is activated for this license
    act_res = await db.execute(
        select(LicenseActivation)
        .where(
            LicenseActivation.license_id == license_obj.id,
            LicenseActivation.device_id == data.device_id
        )
    )
    activation = act_res.scalars().first()
    
    if not activation:
        # Key exists but this device is not registered
        # If the key itself is new, return not_activated
        if license_obj.status == "new":
            return ClientCheckResponse(status="not_activated", server_time=now)
        return ClientCheckResponse(status="device_not_activated", server_time=now)

    # 3. Check expiration
    if license_obj.status == "active" and not license_obj.is_lifetime and license_obj.expires_at:
        if now > to_vn_tz(license_obj.expires_at):
            license_obj.status = "expired"
            license_obj.updated_at = now
            db.add(license_obj)
            await db.commit()
            
    if license_obj.status == "expired":
        return ClientCheckResponse(
            status="expired",
            expires_at=license_obj.expires_at,
            server_time=now
        )

    # 4. If active and valid, update last_checked_at
    activation.last_checked_at = now
    db.add(activation)
    await db.commit()

    return ClientCheckResponse(
        status="valid",
        expires_at=license_obj.expires_at,
        server_time=now
    )
