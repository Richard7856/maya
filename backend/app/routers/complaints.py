"""
Complaints router — quejas de inquilinos con soporte de anonimato.

La tabla 'complaints' tiene is_anonymous (default TRUE). La vista
'complaints_safe' oculta tenant_id cuando is_anonymous=TRUE, por lo que
el admin nunca ve quién envió una queja anónima.

El admin puede cambiar el status para dar seguimiento; no puede ver la
identidad si la queja fue marcada como anónima.
"""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/complaints", tags=["complaints"])

VALID_STATUSES = {"open", "investigating", "resolved", "closed"}


class UpdateComplaintStatus(BaseModel):
    status: str


@router.get("")
async def list_complaints(
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    complaint_status: str | None = Query(None, alias="status"),
    building_id: UUID | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Lista quejas usando la vista complaints_safe que oculta identidades anónimas.
    Incluye rooms JOIN para saber a qué edificio pertenece la queja.
    """
    query = (
        supabase.table("complaints_safe")
        .select("*, rooms(room_number, building_id, buildings(name))")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if complaint_status:
        query = query.eq("status", complaint_status)
    if building_id:
        # Filtrar por building via rooms JOIN
        query = query.eq("rooms.building_id", str(building_id))

    result = query.execute()
    return result.data


@router.patch("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: UUID,
    body: UpdateComplaintStatus,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Actualiza el status de una queja. Admin only."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status inválido. Opciones: {', '.join(VALID_STATUSES)}",
        )

    result = (
        supabase.table("complaints")
        .update({"status": body.status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(complaint_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queja no encontrada.")
    return result.data[0]
