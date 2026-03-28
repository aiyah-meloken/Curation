from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import require_admin
from database import db

router = APIRouter(tags=["users"])


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_users(admin: dict = Depends(require_admin)):
    return db.list_users()


@router.patch("/{user_id}")
async def update_user(user_id: int, req: UpdateUserRequest,
                      admin: dict = Depends(require_admin)):
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.role and req.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'user'")
    # 只允许存在一个 admin
    if req.role == "admin":
        existing_admins = [u for u in db.list_users() if u["role"] == "admin" and u["id"] != user_id]
        if existing_admins:
            raise HTTPException(status_code=400, detail="只能有一个管理员账号")
    # 不允许把当前唯一的 admin 降级
    if req.role == "user":
        current = db.get_user_by_id(user_id)
        if current and current["role"] == "admin":
            other_admins = [u for u in db.list_users() if u["role"] == "admin" and u["id"] != user_id]
            if not other_admins:
                raise HTTPException(status_code=400, detail="不能降级唯一的管理员账号")
    db.update_user(user_id, role=req.role, is_active=req.is_active)
    return db.get_user_by_id(user_id)
