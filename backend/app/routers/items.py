"""
Items router — catálogo de artículos/materiales con historial de precios.

La lógica clave está en POST /{id}/prices: al registrar un nuevo precio
se compara con el último conocido para ese proveedor+artículo. Si la
variación supera el 15% se activa price_alert=True en el registro y
se devuelve el flag al frontend para mostrar la alerta al admin.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from app.dependencies.auth import get_current_user, require_admin
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/items", tags=["items"])

PRICE_ALERT_THRESHOLD = 0.15  # 15% — configurable aquí sin tocar la DB


class ItemCreate(BaseModel):
    name: str
    category: str
    unit: str = "pieza"
    description: str | None = None
    photo_url: str | None = None
    primary_provider_id: str | None = None


class ItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    description: str | None = None
    photo_url: str | None = None
    primary_provider_id: str | None = None
    is_active: bool | None = None


class PriceRecord(BaseModel):
    provider_id: str
    price: float
    notes: str | None = None
    # URL de evidencia (foto del ticket de caja subida a Storage bucket 'receipts')
    receipt_url: str | None = None


@router.get("")
async def list_items(
    _user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    category: str | None = Query(None),
    active_only: bool = Query(True),
):
    """Lista artículos del catálogo con su proveedor principal."""
    query = (
        supabase.table("items")
        .select("*, providers:primary_provider_id(id, name, category)")
        .order("name")
    )
    if active_only:
        query = query.eq("is_active", True)
    if category:
        query = query.eq("category", category)
    result = query.execute()
    return result.data


@router.post("")
async def create_item(
    body: ItemCreate,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Crea un artículo en el catálogo. Admin only."""
    payload = body.model_dump(exclude_none=True)
    result = supabase.table("items").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Error al crear el artículo")
    return result.data[0]


@router.patch("/{item_id}")
async def update_item(
    item_id: UUID,
    body: ItemUpdate,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Actualiza un artículo del catálogo. Admin only."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    result = (
        supabase.table("items")
        .update(updates)
        .eq("id", str(item_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return result.data[0]


@router.get("/{item_id}/prices")
async def get_item_prices(
    item_id: UUID,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    provider_id: str | None = Query(None),
):
    """Historial de precios del artículo, opcionalmente filtrado por proveedor."""
    query = (
        supabase.table("item_prices")
        .select("*, providers(name), user_profiles(first_name, last_name)")
        .eq("item_id", str(item_id))
        .order("recorded_at", desc=True)
    )
    if provider_id:
        query = query.eq("provider_id", provider_id)
    result = query.execute()
    return result.data


@router.post("/{item_id}/prices")
async def record_price(
    item_id: UUID,
    body: PriceRecord,
    current_user: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """
    Registra un precio nuevo para artículo + proveedor.

    Compara contra el último precio registrado para ese mismo par.
    Si la variación supera PRICE_ALERT_THRESHOLD (15%) activa price_alert=True
    y lo incluye en la respuesta para que el frontend muestre la alerta.
    """
    # Obtener el último precio conocido para este artículo + proveedor
    prev_result = (
        supabase.table("item_prices")
        .select("price")
        .eq("item_id", str(item_id))
        .eq("provider_id", body.provider_id)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )

    price_alert = False
    previous_price = None

    if prev_result.data:
        previous_price = float(prev_result.data[0]["price"])
        variation = abs(body.price - previous_price) / previous_price
        if variation > PRICE_ALERT_THRESHOLD:
            price_alert = True

    payload = {
        "item_id": str(item_id),
        "provider_id": body.provider_id,
        "price": body.price,
        "notes": body.notes,
        "receipt_url": body.receipt_url,
        "recorded_by": str(current_user.id),
        "price_alert": price_alert,
    }
    result = supabase.table("item_prices").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Error al registrar el precio")

    response = result.data[0]
    # Incluir contexto de la alerta para que el frontend lo muestre
    if price_alert and previous_price is not None:
        variation_pct = round((body.price - previous_price) / previous_price * 100, 1)
        response["alert_detail"] = {
            "previous_price": previous_price,
            "variation_pct": variation_pct,
            "message": f"⚠️ Variación de {variation_pct:+.1f}% vs precio anterior (${previous_price:.2f})",
        }

    return response
