from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Literal, Optional
import uuid

from app.api import deps
from app.models.admin import Admin
from app.models.activation import LicenseActivation
from app.models.category import Category
from app.schemas.license import LicenseCreate, LicenseOut, LicenseRenew
from app.schemas.activation import ActivationOut
from app.services import license_service

router = APIRouter()

@router.get("", response_model=dict)
async def get_licenses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    category_id: Optional[uuid.UUID] = Query(default=None),
    status: Optional[Literal["new", "active", "expired", "revoked", "lifetime"]] = Query(default=None),
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Retrieve all license keys with filters, search, and pagination."""
    licenses, total = await license_service.get_licenses_list(
        db, page=page, page_size=page_size, search=search, category_id=category_id, status=status
    )
    return {
        "items": licenses,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/stats")
async def get_license_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Retrieve aggregate statistics for dashboard overview."""
    from app.models.license import License
    
    await license_service.sync_expired_licenses(db)
    
    stmt = select(License.status, func.count(License.id)).group_by(License.status)
    res = await db.execute(stmt)
    rows = res.all()
    
    stats = {
        "total": 0,
        "new": 0,
        "active": 0,
        "expired": 0,
        "revoked": 0,
        "total_activations": 0
    }
    
    for row in rows:
        status_name, count = row
        if status_name in stats:
            stats[status_name] = count
        stats["total"] += count
        
    act_stmt = (
        select(func.count(LicenseActivation.id))
        .join(License, LicenseActivation.license_id == License.id)
        .where(License.status == "active")
    )
    act_res = await db.execute(act_stmt)
    stats["total_activations"] = act_res.scalar() or 0
    
    return stats

@router.post("", response_model=List[LicenseOut], status_code=status.HTTP_201_CREATED)
async def create_licenses(
    data: LicenseCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Generate and create license keys in bulk."""
    try:
        licenses = await license_service.create_licenses(db, data)
        category_name = await db.scalar(
            select(Category.name).where(Category.id == data.category_id)
        )

        out = []
        for l in licenses:
            out.append(
                LicenseOut(
                    id=l.id,
                    key=l.key,
                    category_id=l.category_id,
                    category_name=category_name,
                    duration_type=l.duration_type,
                    duration_value=l.duration_value,
                    max_devices=l.max_devices,
                    activated_at=l.activated_at,
                    expires_at=l.expires_at,
                    is_lifetime=l.is_lifetime,
                    status=l.status,
                    created_at=l.created_at,
                    updated_at=l.updated_at,
                    devices_count=0
                )
            )
        return out
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{license_id}/renew", response_model=LicenseOut)
async def renew_license(
    license_id: uuid.UUID,
    data: LicenseRenew,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Renew a license key (extend duration or set lifetime)."""
    try:
        license_obj = await license_service.renew_license(db, license_id, data)
        
        # Get count of active devices and category name
        count_res = await db.execute(
            select(func.count(LicenseActivation.id)).where(LicenseActivation.license_id == license_id)
        )
        devices_count = count_res.scalar() or 0

        cat_res = await db.execute(select(Category).filter_by(id=license_obj.category_id))
        cat = cat_res.scalars().first()
        category_name = cat.name if cat else None

        return LicenseOut(
            id=license_obj.id,
            key=license_obj.key,
            category_id=license_obj.category_id,
            category_name=category_name,
            duration_type=license_obj.duration_type,
            duration_value=license_obj.duration_value,
            max_devices=license_obj.max_devices,
            activated_at=license_obj.activated_at,
            expires_at=license_obj.expires_at,
            is_lifetime=license_obj.is_lifetime,
            status=license_obj.status,
            created_at=license_obj.created_at,
            updated_at=license_obj.updated_at,
            devices_count=devices_count
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.delete("/{license_id}")
async def revoke_license(
    license_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Revoke a license key (soft delete)."""
    try:
        await license_service.revoke_license(db, license_id)
        return {"status": "success", "message": "License key revoked successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.delete("/{license_id}/permanent")
async def delete_revoked_license(
    license_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Permanently delete a revoked license key."""
    try:
        await license_service.delete_revoked_license(db, license_id)
        return {"status": "success", "message": "Revoked license key permanently deleted"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{license_id}/activations", response_model=List[ActivationOut])
async def get_license_activations(
    license_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Get active devices information for a specific license key."""
    result = await db.execute(
        select(LicenseActivation)
        .where(LicenseActivation.license_id == license_id)
        .order_by(LicenseActivation.activated_at.desc())
    )
    activations = result.scalars().all()
    return activations
