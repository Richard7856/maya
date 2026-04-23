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

from app.dependencies.auth import get_current_user, require_admin, require_tenant
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/complaints", tags=["complaints"])

VALID_STATUSES   = {"open", "investigating", "resolved", "closed"}
VALID_CATEGORIES = {"ruido", "daños", "limpieza", "seguridad", "otro"}


class UpdateComplaintStatus(BaseModel):
    status: str


class CreateComplaintBody(BaseModel):
    category:     str
    description:  str
    is_anonymous: bool = True   # Por defecto anónimo — el tenant puede desactivarlo


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_complaint(
    body: CreateComplaintBody,
    current_user: Annotated[UserProfile, Depends(require_tenant)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Tenant crea una queja (ruido, daños, limpieza, etc.).

    El room_id y building_id se obtienen del contrato activo del tenant —
    no se confía en lo que mande el cliente. is_anonymous permite ocultar
    la identidad ante el admin (via complaints_safe view).
    """
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Categoría inválida. Opciones: {', '.join(sorted(VALID_CATEGORIES))}",
        )

    # Obtener room_id y building_id del contrato activo
    lease_result = (
        supabase.table("leases")
        .select("room_id, rooms!inner(building_id)")
        .eq("tenant_id", str(current_user.id))
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not lease_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tienes un contrato activo para reportar quejas.",
        )

    lease     = lease_result.data[0]
    room_id   = lease["room_id"]
    building_id = lease["rooms"]["building_id"]

    payload = {
        "building_id":    building_id,
        "complainant_id": str(current_user.id),
        "room_id":        room_id,
        "category":       body.category,
        "description":    body.description,
        "is_anonymous":   body.is_anonymous,
        "status":         "open",
    }

    result = supabase.table("complaints").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo crear la queja.")
    return result.data[0]


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
