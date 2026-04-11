"""
Incidents router — maintenance issue tracking.

Tenants, cleaners, and admins can report incidents. Photos and status updates
are tracked as separate child records. Tenants only see incidents in their own room.
"""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin, require_role
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/incidents", tags=["incidents"])

# Anyone who interacts with rooms can report incidents
_require_reporter = require_role("admin", "tenant", "cleaning")


class CreateIncidentBody(BaseModel):
    room_id: UUID
    title: str
    description: str
    category: str   # plumbing, electrical, structural, appliance, other
    priority: str = "medium"  # low, medium, high, urgent


class UpdateIncidentBody(BaseModel):
    status: str | None = None
    priority: str | None = None
    assigned_to: UUID | None = None
    repair_cost: float | None = None


class CreateUpdateBody(BaseModel):
    note: str
    status_changed_to: str | None = None


class AddPhotoBody(BaseModel):
    url: str
    type: str = "during"  # before, during, after
    caption: str | None = None


def _get_tenant_room_id(user_id: str, supabase: Client) -> str | None:
    """Returns the room_id from the tenant's active lease, or None."""
    result = (
        supabase.table("leases")
        .select("room_id")
        .eq("tenant_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    return result.data[0]["room_id"] if result.data else None


@router.get("")
async def list_incidents(
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    building_id: UUID | None = Query(None),
    room_id: UUID | None = Query(None),
    incident_status: str | None = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Lists incidents. Admins see all; tenants see only their room's incidents."""
    select = "*, rooms!inner(room_number, building_id)" if building_id else "*, rooms(room_number, building_id)"
    query = supabase.table("incidents").select(select)

    # Tenants can only see incidents for their own room
    if current_user.role == "tenant":
        tenant_room = _get_tenant_room_id(str(current_user.id), supabase)
        if not tenant_room:
            return []
        query = query.eq("room_id", tenant_room)
    elif room_id:
        query = query.eq("room_id", str(room_id))

    if building_id:
        query = query.eq("rooms.building_id", str(building_id))
    if incident_status:
        query = query.eq("status", incident_status)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data


@router.get("/{incident_id}")
async def get_incident(
    incident_id: UUID,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns incident details with photos and update history."""
    result = (
        supabase.table("incidents")
        .select("*, rooms(room_number, building_id), incident_photos(*), incident_updates(*)")
        .eq("id", str(incident_id))
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    # Tenants can only see their own room's incidents
    if current_user.role == "tenant":
        tenant_room = _get_tenant_room_id(str(current_user.id), supabase)
        if result.data["room_id"] != tenant_room:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return result.data


@router.post("")
async def create_incident(
    body: CreateIncidentBody,
    current_user: Annotated[UserProfile, Depends(_require_reporter)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Reports a new incident. Tenants can only report for their own room."""
    # Tenants: validate the room belongs to their lease
    if current_user.role == "tenant":
        tenant_room = _get_tenant_room_id(str(current_user.id), supabase)
        if str(body.room_id) != tenant_room:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only report incidents for your own room.",
            )

    result = (
        supabase.table("incidents")
        .insert({
            "room_id": str(body.room_id),
            "reported_by": str(current_user.id),
            "title": body.title,
            "description": body.description,
            "category": body.category,
            "priority": body.priority,
            "status": "open",
        })
        .execute()
    )
    return result.data[0]


@router.put("/{incident_id}")
async def update_incident(
    incident_id: UUID,
    body: UpdateIncidentBody,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Updates incident status, priority, or assignment (admin only)."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    # Convert UUID to string for Supabase
    if "assigned_to" in updates:
        updates["assigned_to"] = str(updates["assigned_to"])

    if updates.get("status") == "resolved":
        updates["resolved_at"] = datetime.now(timezone.utc).isoformat()

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("incidents")
        .update(updates)
        .eq("id", str(incident_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")
    return result.data[0]


@router.post("/{incident_id}/updates")
async def add_incident_update(
    incident_id: UUID,
    body: CreateUpdateBody,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Adds a status update note to an incident."""
    # Verify incident exists
    incident = (
        supabase.table("incidents")
        .select("id, reported_by")
        .eq("id", str(incident_id))
        .single()
        .execute()
    )
    if not incident.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    # Non-admins can only add updates to incidents they reported
    if current_user.role != "admin" and incident.data["reported_by"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    update_data = {
        "incident_id": str(incident_id),
        "author_id": str(current_user.id),
        "note": body.note,
    }
    if body.status_changed_to:
        update_data["status_changed_to"] = body.status_changed_to
        # Only admins can change status via updates
        if current_user.role == "admin":
            supabase.table("incidents").update({
                "status": body.status_changed_to,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", str(incident_id)).execute()

    result = supabase.table("incident_updates").insert(update_data).execute()
    return result.data[0]


@router.post("/{incident_id}/photos")
async def add_incident_photo(
    incident_id: UUID,
    body: AddPhotoBody,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Adds a photo reference to an incident (URL from presigned upload)."""
    # Verify incident exists
    incident = (
        supabase.table("incidents")
        .select("id")
        .eq("id", str(incident_id))
        .single()
        .execute()
    )
    if not incident.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    result = (
        supabase.table("incident_photos")
        .insert({
            "incident_id": str(incident_id),
            "url": body.url,
            "type": body.type,
            "caption": body.caption,
            "taken_by": str(current_user.id),
            "taken_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )
    return result.data[0]
