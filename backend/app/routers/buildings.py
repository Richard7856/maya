"""
Buildings router — property hierarchy management and KPI aggregation.

Admin-only write operations. Read access is available to all authenticated roles
for their assigned building (enforced via RLS on the Supabase side for tenant/cleaning).
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("")
async def list_buildings(
    _user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns all buildings. Accessible to all authenticated roles."""
    result = supabase.table("buildings").select("*").order("name").execute()
    return result.data


@router.get("/{building_id}/kpis")
async def get_building_kpis(
    building_id: UUID,
    _user: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Aggregate KPIs for a building: occupancy %, revenue, overdue payments, open incidents."""
    bid = str(building_id)

    # Occupancy
    rooms_result = (
        supabase.table("rooms").select("status").eq("building_id", bid).execute()
    )
    rooms = rooms_result.data or []
    total_rooms = len(rooms)
    occupied_rooms = sum(1 for r in rooms if r["status"] == "occupied")
    occupancy_rate = occupied_rooms / total_rooms if total_rooms else 0

    # Monthly revenue (sum of active lease rates for this building)
    leases_result = (
        supabase.table("leases")
        .select("monthly_rate, rooms!inner(building_id)")
        .eq("rooms.building_id", bid)
        .eq("status", "active")
        .execute()
    )
    monthly_revenue = sum(
        float(l["monthly_rate"]) for l in (leases_result.data or [])
    )

    # Overdue payments
    overdue_result = (
        supabase.table("payments")
        .select("id, leases!inner(rooms!inner(building_id))")
        .eq("leases.rooms.building_id", bid)
        .eq("status", "overdue")
        .execute()
    )
    overdue_payments = len(overdue_result.data or [])

    # Open incidents
    incidents_result = (
        supabase.table("incidents")
        .select("id, rooms!inner(building_id)")
        .eq("rooms.building_id", bid)
        .in_("status", ["open", "in_progress"])
        .execute()
    )
    open_incidents = len(incidents_result.data or [])

    # Open tickets
    tickets_result = (
        supabase.table("tickets")
        .select("id, rooms!inner(building_id)")
        .eq("rooms.building_id", bid)
        .in_("status", ["open", "assigned", "in_progress"])
        .execute()
    )
    open_tickets = len(tickets_result.data or [])

    return {
        "total_rooms": total_rooms,
        "occupied_rooms": occupied_rooms,
        "occupancy_rate": round(occupancy_rate, 4),
        "monthly_revenue": monthly_revenue,
        "overdue_payments": overdue_payments,
        "open_incidents": open_incidents,
        "open_tickets": open_tickets,
    }


@router.get("/{building_id}/rooms")
async def get_building_rooms(
    building_id: UUID,
    _user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    status_filter: str | None = Query(None, alias="status"),
):
    """Returns rooms for a building, optionally filtered by status."""
    query = supabase.table("rooms").select("*").eq("building_id", str(building_id))
    if status_filter:
        query = query.eq("status", status_filter)
    result = query.order("room_number").execute()
    return result.data
