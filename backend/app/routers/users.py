"""
Users router — profile management for all roles.

Tenants and staff can view/update their own profile.
Admins can list all users, view any profile, and lock/unlock accounts.
Lock is used by WF-02 (day 11 non-payment) and manual admin action.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/users", tags=["users"])

# Fields safe to return — excludes internal-only columns
_USER_SELECT = "id, role, first_name, last_name, phone, rfc, is_active, is_locked, expo_push_token, created_at"


class UpdateProfileBody(BaseModel):
    """Only these fields can be self-updated — prevents role/status tampering."""
    phone: str | None = None
    expo_push_token: str | None = None


# ── /me endpoints must be registered before /{user_id} ───────────────────────
# Otherwise FastAPI tries to parse "me" as a UUID → 422

@router.get("/me")
async def get_my_profile(
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns the full profile for the authenticated user."""
    result = (
        supabase.table("user_profiles")
        .select(_USER_SELECT)
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )
    return result.data


@router.put("/me")
async def update_my_profile(
    body: UpdateProfileBody,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Updates the authenticated user's own profile (whitelisted fields only)."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    result = (
        supabase.table("user_profiles")
        .update(updates)
        .eq("id", str(current_user.id))
        .execute()
    )
    return result.data[0] if result.data else None


# ── Admin-only endpoints ─────────────────────────────────────────────────────

@router.get("")
async def list_users(
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    role: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Lists all users with optional role filter and pagination."""
    query = supabase.table("user_profiles").select(_USER_SELECT)

    if role:
        query = query.eq("role", role)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns a single user profile by ID."""
    result = (
        supabase.table("user_profiles")
        .select(_USER_SELECT)
        .eq("id", str(user_id))
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return result.data


@router.patch("/{user_id}/lock")
async def lock_user(
    user_id: UUID,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Locks a user account (prevents app access until unlocked)."""
    result = (
        supabase.table("user_profiles")
        .update({"is_locked": True})
        .eq("id", str(user_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return result.data[0]


@router.patch("/{user_id}/unlock")
async def unlock_user(
    user_id: UUID,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Unlocks a previously locked user account."""
    result = (
        supabase.table("user_profiles")
        .update({"is_locked": False})
        .eq("id", str(user_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return result.data[0]
