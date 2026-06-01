from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.api import deps
from app.models.category import Category
from app.models.admin import Admin
from app.schemas.category import CategoryCreate, CategoryOut

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
    await db.commit()
    await db.refresh(category)
    return category
