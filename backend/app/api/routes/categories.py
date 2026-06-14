from fastapi import APIRouter, Depends, HTTPException, status, Query
import uuid as uuid_mod
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.future import select
from typing import List

from app.api import deps
from app.models.category import Category
from app.models.admin import Admin
from app.models.license import License
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdateVersion
from app.core.config import settings

router = APIRouter()

@router.get("", response_model=List[CategoryOut])
async def get_categories(
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """List all categories."""
    result = await db.execute(
        select(Category).order_by(Category.name.asc())
    )
    categories = result.scalars().all()
    return categories

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Create a new category."""
    # Check if category name already exists
    result = await db.execute(
        select(Category).filter_by(name=data.name)
    )
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )
        
    category = Category(
        name=data.name,
        description=data.description
    )
    db.add(category)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )
    await db.refresh(category)
    return category

@router.patch("/{category_id}/version", response_model=CategoryOut)
async def update_category_version(
    category_id: uuid_mod.UUID,
    data: CategoryUpdateVersion,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Update version and update_url for a category."""
    result = await db.execute(
        select(Category).filter_by(id=category_id)
    )
    category = result.scalars().first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    category.version = data.version
    category.update_url = data.update_url
    await db.commit()
    await db.refresh(category)
    return category

@router.delete("/{category_id}")
async def delete_category(
    category_id: uuid_mod.UUID,
    auth_code: str = Query(..., description="Security Code / Password Change Code"),
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Admin = Depends(deps.get_current_admin)
):
    """Delete a category. Requires current PASSWORD_CHANGE_AUTH_CODE."""
    if auth_code != settings.PASSWORD_CHANGE_AUTH_CODE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect security code / password change authorization code"
        )
    
    result = await db.execute(
        select(Category).filter_by(id=category_id)
    )
    category = result.scalars().first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
        
    # Check if category has any licenses
    license_check = await db.execute(
        select(License).filter_by(category_id=category_id).limit(1)
    )
    if license_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete category because it has associated license keys. Delete or reassign the keys first."
        )
        
    await db.delete(category)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete category due to database constraints."
        )
        
    return {"status": "success", "message": "Category deleted successfully"}

