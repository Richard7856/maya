"""
Cleaning router — assignment scheduling and session tracking.

Admins create cleaning assignments (cleaner + room + date + time block).
Cleaners start sessions with GPS coordinates and complete them with a checklist.
Time blocks map to 2-hour windows: 1=8:00-10:00, 2=10:00-12:00, 3=12:00-14:00, 4=14:00-16:00.
"""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin, require_cleaning
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/cleaning", tags=["cleaning"])


class CreateAssignmentBody(BaseModel):
    cleaner_id: UUID
    room_id: UUID
    scheduled_date: str  # ISO date string YYYY-MM-DD
    time_block: int      # 1-4


class UpdateAssignmentStatusBody(BaseModel):
    status: str


class StartSessionBody(BaseModel):
    arrival_lat: float
    arrival_lng: float


class ChecklistItemBody(BaseModel):
    label: str
    is_done: bool = False
    photo_url: str | None = None
    notes: str | None = None


class CompleteSessionBody(BaseModel):
    checklist_items: list[ChecklistItemBody]


# Cleaners can only set these statuses on assignments
_CLEANER_ALLOWED_STATUSES = {"confirmed", "in_progress", "completed"}


@router.get("/assignments")
async def list_assignments(
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    building_id: UUID | None = Query(None),
    cleaner_id: UUID | None = Query(None),
    assignment_status: str | None = Query(None, alias="status"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Lists cleaning assignments. Admins see all; cleaners see only their own."""
    select = (
        "*, rooms!inner(room_number, building_id)"
        if building_id
        else "*, rooms(room_number, building_id)"
    )
    query = supabase.table("cleaning_assignments").select(select)

    # Cleaners only see their own assignments
    if current_user.role != "admin":
        query = query.eq("cleaner_id", str(current_user.id))
    elif cleaner_id:
        query = query.eq("cleaner_id", str(cleaner_id))

    if assignment_status:
        query = query.eq("status", assignment_status)
    if building_id:
        query = query.eq("rooms.building_id", str(building_id))
    if date_from:
        query = query.gte("scheduled_date", date_from)
    if date_to:
        query = query.lte("scheduled_date", date_to)

    query = query.order("scheduled_date", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data


@router.get("/assignments/{assignment_id}")
async def get_assignment(
    assignment_id: UUID,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns assignment details with session data (if started)."""
    query = (
        supabase.table("cleaning_assignments")
        .select("*, rooms(room_number, building_id, section), cleaning_sessions(*)")
        .eq("id", str(assignment_id))
    )

    if current_user.role != "admin":
        query = query.eq("cleaner_id", str(current_user.id))

    result = query.single().execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")
    return result.data


@router.post("/assignments")
async def create_assignment(
    body: CreateAssignmentBody,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Creates a cleaning assignment. Fails with 409 if duplicate (cleaner+room+date)."""
    if body.time_block not in (1, 2, 3, 4):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="time_block must be 1-4.",
        )

    try:
        result = (
            supabase.table("cleaning_assignments")
            .insert({
                "cleaner_id": str(body.cleaner_id),
                "room_id": str(body.room_id),
                "scheduled_date": body.scheduled_date,
                "time_block": body.time_block,
                "status": "scheduled",
            })
            .execute()
        )
    except Exception as exc:
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Assignment already exists for this cleaner, room, and date.",
            ) from exc
        raise

    return result.data[0]


@router.patch("/assignments/{assignment_id}/status")
async def update_assignment_status(
    assignment_id: UUID,
    body: UpdateAssignmentStatusBody,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Updates assignment status. Cleaners can only set confirmed/in_progress/completed."""
    if current_user.role != "admin" and body.status not in _CLEANER_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cleaners can only set status to: {', '.join(_CLEANER_ALLOWED_STATUSES)}",
        )

    query = (
        supabase.table("cleaning_assignments")
        .select("id, cleaner_id")
        .eq("id", str(assignment_id))
        .single()
    )
    assignment = query.execute()

    if not assignment.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    if current_user.role != "admin" and assignment.data["cleaner_id"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your assignment.")

    result = (
        supabase.table("cleaning_assignments")
        .update({"status": body.status})
        .eq("id", str(assignment_id))
        .execute()
    )
    return result.data[0]


@router.post("/sessions/{assignment_id}/start")
async def start_session(
    assignment_id: UUID,
    body: StartSessionBody,
    current_user: Annotated[UserProfile, Depends(require_cleaning)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Starts a cleaning session — records arrival time and GPS coordinates."""
    # Validate assignment belongs to this cleaner
    assignment = (
        supabase.table("cleaning_assignments")
        .select("id, cleaner_id, status")
        .eq("id", str(assignment_id))
        .eq("cleaner_id", str(current_user.id))
        .single()
        .execute()
    )

    if not assignment.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    if assignment.data["status"] not in ("scheduled", "confirmed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start session — assignment status is '{assignment.data['status']}'.",
        )

    now = datetime.now(timezone.utc).isoformat()

    # Create the session record
    session_result = (
        supabase.table("cleaning_sessions")
        .insert({
            "assignment_id": str(assignment_id),
            "arrived_at": now,
            "arrival_lat": body.arrival_lat,
            "arrival_lng": body.arrival_lng,
        })
        .execute()
    )

    # Update assignment status to in_progress
    supabase.table("cleaning_assignments").update(
        {"status": "in_progress"}
    ).eq("id", str(assignment_id)).execute()

    return session_result.data[0]


@router.post("/sessions/{assignment_id}/complete")
async def complete_session(
    assignment_id: UUID,
    body: CompleteSessionBody,
    current_user: Annotated[UserProfile, Depends(require_cleaning)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Completes a cleaning session with a checklist of items."""
    # Find the active session for this assignment
    session = (
        supabase.table("cleaning_sessions")
        .select("id, assignment_id")
        .eq("assignment_id", str(assignment_id))
        .is_("completed_at", "null")
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found for this assignment.",
        )

    # Verify the assignment belongs to this cleaner
    assignment = (
        supabase.table("cleaning_assignments")
        .select("cleaner_id")
        .eq("id", str(assignment_id))
        .eq("cleaner_id", str(current_user.id))
        .single()
        .execute()
    )
    if not assignment.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your assignment.")

    now = datetime.now(timezone.utc).isoformat()
    session_id = session.data["id"]

    # Mark session as complete
    supabase.table("cleaning_sessions").update(
        {"completed_at": now}
    ).eq("id", session_id).execute()

    # Mark assignment as completed
    supabase.table("cleaning_assignments").update(
        {"status": "completed"}
    ).eq("id", str(assignment_id)).execute()

    # Insert checklist items
    if body.checklist_items:
        items = [
            {
                "session_id": session_id,
                "label": item.label,
                "is_done": item.is_done,
                "photo_url": item.photo_url,
                "notes": item.notes,
                "completed_at": now if item.is_done else None,
            }
            for item in body.checklist_items
        ]
        supabase.table("cleaning_checklist_items").insert(items).execute()

    return {"session_id": session_id, "completed_at": now, "checklist_count": len(body.checklist_items)}
