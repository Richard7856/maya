"""
Tickets router — work orders for cleaning and maintenance.

Admins create and assign tickets to staff. Staff members can update status
on tickets assigned to them. Building filter works via inner join with rooms.
"""
from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/tickets", tags=["tickets"])


class CreateTicketBody(BaseModel):
    room_id: UUID
    type: str  # cleaning or maintenance
    title: str
    description: str
    priority: str = "medium"
    assigned_to: UUID | None = None
    due_date: date | None = None


class UpdateTicketBody(BaseModel):
    title: str | None = None
    description: str | None = None
    type: str | None = None
    priority: str | None = None
    assigned_to: UUID | None = None
    due_date: date | None = None
    status: str | None = None


class UpdateStatusBody(BaseModel):
    status: str


# Staff can only transition to these statuses
_STAFF_ALLOWED_STATUSES = {"in_progress", "resolved"}


@router.get("")
async def list_tickets(
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    ticket_type: str | None = Query(None, alias="type"),
    ticket_status: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    building_id: UUID | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Lists tickets. Admins see all; staff sees only their assigned tickets."""
    select = "*, rooms!inner(room_number, building_id)" if building_id else "*, rooms(room_number, building_id)"
    query = supabase.table("tickets").select(select)

    # Non-admins only see tickets assigned to them
    if current_user.role != "admin":
        query = query.eq("assigned_to", str(current_user.id))

    if ticket_type:
        query = query.eq("type", ticket_type)
    if ticket_status:
        query = query.eq("status", ticket_status)
    if priority:
        query = query.eq("priority", priority)
    if building_id:
        query = query.eq("rooms.building_id", str(building_id))

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: UUID,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns ticket details. Non-admins can only view their assigned tickets."""
    query = (
        supabase.table("tickets")
        .select("*, rooms(room_number, building_id)")
        .eq("id", str(ticket_id))
    )

    if current_user.role != "admin":
        query = query.eq("assigned_to", str(current_user.id))

    result = query.single().execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    return result.data


@router.post("")
async def create_ticket(
    body: CreateTicketBody,
    current_user: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Creates a new work order ticket (admin only)."""
    ticket_data = {
        "room_id": str(body.room_id),
        "created_by": str(current_user.id),
        "type": body.type,
        "title": body.title,
        "description": body.description,
        "priority": body.priority,
        "status": "open",
    }
    if body.assigned_to:
        ticket_data["assigned_to"] = str(body.assigned_to)
    if body.due_date:
        ticket_data["due_date"] = body.due_date.isoformat()

    result = supabase.table("tickets").insert(ticket_data).execute()
    return result.data[0]


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: UUID,
    body: UpdateTicketBody,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Updates a ticket (admin only)."""
    updates = {}
    for field, value in body.model_dump().items():
        if value is None:
            continue
        if field == "assigned_to":
            updates[field] = str(value)
        elif field == "due_date":
            updates[field] = value.isoformat()
        else:
            updates[field] = value

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("tickets")
        .update(updates)
        .eq("id", str(ticket_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    return result.data[0]


@router.patch("/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: UUID,
    body: UpdateStatusBody,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Updates ticket status. Staff can only set 'in_progress' or 'resolved'."""
    # Staff: restricted status transitions
    if current_user.role != "admin" and body.status not in _STAFF_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Staff can only set status to: {', '.join(_STAFF_ALLOWED_STATUSES)}",
        )

    query = (
        supabase.table("tickets")
        .select("id, assigned_to")
        .eq("id", str(ticket_id))
        .single()
    )
    ticket = query.execute()

    if not ticket.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    # Staff can only update tickets assigned to them
    if current_user.role != "admin" and ticket.data["assigned_to"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to you.")

    result = (
        supabase.table("tickets")
        .update({"status": body.status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(ticket_id))
        .execute()
    )
    return result.data[0]
