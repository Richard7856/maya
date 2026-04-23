"""
Providers router — catálogo de proveedores por zona y categoría.

Escritura: solo admin.
Lectura: admin + cleaning (para ver proveedores en la app de limpieza).
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/providers", tags=["providers"])

VALID_CATEGORIES = (
    "plumbing", "electrical", "cleaning", "maintenance",
    "security", "appliances", "telecom", "other"
)


class ProviderCreate(BaseModel):
    name: str
    category: str
    phone: str | None = None
    whatsapp: str | None = None
    zone: str | None = None
    building_id: str | None = None
    photo_url: str | None = None
    notes: str | None = None


class ProviderUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    zone: str | None = None
    building_id: str | None = None
    photo_url: str | None = None
    notes: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_providers(
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    category: str | None = Query(None),
    zone: str | None = Query(None),
    building_id: str | None = Query(None),
    active_only: bool = Query(True),
):
    """
    Lista proveedores con filtros opcionales.
    Admin ve todos; cleaning solo ve los activos (para el directorio).
    """
    query = (
        supabase.table("providers")
        .select("*, buildings(name)")
        .order("name")
    )
    if active_only or current_user.role != "admin":
        query = query.eq("is_active", True)
    if category:
        query = query.eq("category", category)
    if zone:
        # ilike para búsqueda parcial case-insensitive ("roma" encuentra "Zona Roma")
        query = query.ilike("zone", f"%{zone}%")
    if building_id:
        query = query.eq("building_id", building_id)

    result = query.execute()
    return result.data


@router.post("")
async def create_provider(
    body: ProviderCreate,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Crea un proveedor. Admin only."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoría inválida. Válidas: {VALID_CATEGORIES}")
    payload = body.model_dump(exclude_none=True)
    result = supabase.table("providers").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Error al crear el proveedor")
    return result.data[0]


@router.patch("/{provider_id}")
async def update_provider(
    provider_id: UUID,
    body: ProviderUpdate,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Actualiza datos de un proveedor, incluyendo activar/desactivar. Admin only."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    if "category" in updates and updates["category"] not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoría inválida.")
    result = (
        supabase.table("providers")
        .update(updates)
        .eq("id", str(provider_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return result.data[0]
