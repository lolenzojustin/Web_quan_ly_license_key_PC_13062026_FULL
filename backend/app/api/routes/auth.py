from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.admin import Admin
from app.schemas.auth import Token, LoginSchema, ChangePasswordSchema

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(
    data: LoginSchema,
    db: AsyncSession = Depends(deps.get_db)
):
    """Admin login endpoint."""
    result = await db.execute(
        select(Admin).filter_by(username=data.username)
    )
    admin = result.scalars().first()
    
    if not admin or not verify_password(data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password"
        )
        
    # Subject of the JWT is the admin UUID
    access_token = create_access_token(subject=str(admin.id))
    return Token(access_token=access_token)

@router.post("/change-password")
async def change_password(
    data: ChangePasswordSchema,
    current_admin: Admin = Depends(deps.get_current_admin),
    db: AsyncSession = Depends(deps.get_db)
):
    """Change current admin's password."""
    if not verify_password(data.old_password, current_admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password"
        )
        
    current_admin.password_hash = get_password_hash(data.new_password)
    db.add(current_admin)
    await db.commit()
    return {"status": "success", "message": "Password changed successfully"}
