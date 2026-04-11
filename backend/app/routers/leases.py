"""
Leases router — manages the contractual relationship between tenants and rooms.

A lease ties a tenant to a room with a monthly rate, payment schedule, and access credentials.
Only one active lease per room is enforced at the DB level (unique partial index).
When a lease is created, the room status flips to 'occupied'; when terminated, back to 'vacant'.
"""
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin, require_admin_or_tenant, require_tenant
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile
from app.services.encryption import encrypt_access_code

router = APIRouter(prefix="/leases", tags=["leases"])

_LEASE_SELECT = "*, rooms(room_number, building_id, section)"


class CreateLeaseBody(BaseModel):
    room_id: UUID
    tenant_id: UUID
    start_date: date
    end_date: date | None = None
    monthly_rate: float
    payment_day: int  # 1-28
    deposit_amount: float | None = None
    contract_url: str | None = None
    wifi_password: str | None = None
    access_code: str | None = None  # Will be encrypted before storage


class UpdateLeaseBody(BaseModel):
    status: str | None = None
    monthly_rate: float | None = None
    end_date: date | None = None
    payment_day: int | None = None
    contract_url: str | None = None
    wifi_password: str | None = None
    access_code: str | None = None  # Will be encrypted before storage


# ── /mine must be before /{lease_id} to avoid path conflict ──────────────────

@router.get("/mine")
async def get_my_lease(
    current_user: Annotated[UserProfile, Depends(require_tenant)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns the tenant's current active lease with room info."""
    result = (
        supabase.table("leases")
        .select(_LEASE_SELECT)
        .eq("tenant_id", str(current_user.id))
        .eq("status", "active")
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active lease found.",
        )
    return result.data[0]


@router.get("")
async def list_leases(
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    building_id: UUID | None = Query(None),
    lease_status: str | None = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Lists all leases with optional building and status filters."""
    select = "*, rooms!inner(room_number, building_id, section)" if building_id else _LEASE_SELECT
    query = supabase.table("leases").select(select)

    if building_id:
        query = query.eq("rooms.building_id", str(building_id))
    if lease_status:
        query = query.eq("status", lease_status)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data


@router.get("/{lease_id}")
async def get_lease(
    lease_id: UUID,
    current_user: Annotated[UserProfile, Depends(require_admin_or_tenant)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns lease details. Tenants can only view their own lease."""
    query = supabase.table("leases").select(_LEASE_SELECT).eq("id", str(lease_id))

    # Tenants can only see their own lease
    if current_user.role == "tenant":
        query = query.eq("tenant_id", str(current_user.id))

    result = query.single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found.",
        )
    return result.data


@router.post("")
async def create_lease(
    body: CreateLeaseBody,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Creates a new lease and marks the room as occupied.

    Fails with 409 if the room already has an active lease (DB unique constraint).
    """
    lease_data = {
        "room_id": str(body.room_id),
        "tenant_id": str(body.tenant_id),
        "start_date": body.start_date.isoformat(),
        "monthly_rate": body.monthly_rate,
        "payment_day": body.payment_day,
    }
    if body.end_date:
        lease_data["end_date"] = body.end_date.isoformat()
    if body.deposit_amount is not None:
        lease_data["deposit_amount"] = body.deposit_amount
    if body.contract_url:
        lease_data["contract_url"] = body.contract_url
    if body.wifi_password:
        lease_data["wifi_password"] = body.wifi_password
    if body.access_code:
        lease_data["access_code_encrypted"] = encrypt_access_code(body.access_code)

    try:
        result = supabase.table("leases").insert(lease_data).execute()
    except Exception as exc:
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This room already has an active lease.",
            ) from exc
        raise

    # Mark room as occupied
    supabase.table("rooms").update({"status": "occupied"}).eq("id", str(body.room_id)).execute()

    return result.data[0]


@router.put("/{lease_id}")
async def update_lease(
    lease_id: UUID,
    body: UpdateLeaseBody,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Updates a lease. If status changes to 'terminated', the room reverts to 'vacant'."""
    updates = {}
    for field, value in body.model_dump().items():
        if value is None:
            continue
        if field == "access_code":
            updates["access_code_encrypted"] = encrypt_access_code(value)
        elif field in ("start_date", "end_date"):
            updates[field] = value.isoformat()
        else:
            updates[field] = value

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    result = (
        supabase.table("leases")
        .update(updates)
        .eq("id", str(lease_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found.",
        )

    # If lease terminated, free up the room
    if body.status == "terminated":
        room_id = result.data[0].get("room_id")
        if room_id:
            supabase.table("rooms").update({"status": "vacant"}).eq("id", room_id).execute()

    return result.data[0]
