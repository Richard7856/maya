"""
Tickets router — work orders for cleaning and maintenance.

Admins create and assign tickets to staff. Staff members can update status
on tickets assigned to them. Building filter works via inner join with rooms.

Phase 2 additions: ticket_items cart (add/remove items with price lookup)
and /requisition endpoint that groups items by best-price provider.
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
    # URL de foto de evidencia — subida por cleaning staff al reportar un desperfecto
    evidence_url: str | None = None


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
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """
    Creates a work order ticket.

    - Admin: puede crear cualquier tipo, asignar a cualquier usuario y establecer todos los campos.
    - Cleaning staff: solo puede crear tickets de tipo 'maintenance' (reportar desperfectos).
      No pueden asignar a otros usuarios — el admin lo asigna desde el dashboard.
    """
    # Cleaning staff solo puede reportar mantenimiento, no crear tickets de limpieza
    if current_user.role == "cleaning" and body.type != "maintenance":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El personal de limpieza solo puede crear tickets de tipo 'maintenance'.",
        )
    # Otros roles no admin no pueden crear tickets
    if current_user.role not in ("admin", "cleaning"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para crear tickets.",
        )

    ticket_data = {
        "room_id": str(body.room_id),
        "created_by": str(current_user.id),
        "type": body.type,
        "title": body.title,
        "description": body.description,
        "priority": body.priority,
        "status": "open",
    }
    # Solo admin puede asignar al crear; cleaning staff lo deja sin asignar
    if body.assigned_to and current_user.role == "admin":
        ticket_data["assigned_to"] = str(body.assigned_to)
    if body.due_date:
        ticket_data["due_date"] = body.due_date.isoformat()
    if body.evidence_url:
        ticket_data["evidence_url"] = body.evidence_url

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


class TicketItemAdd(BaseModel):
    # qty allows decimals (e.g. 2.5 m² of material)
    item_id: UUID
    qty: float = 1.0
    notes: str | None = None


# ─── Ticket items (Phase 2: marketplace cart) ─────────────────────────────────

@router.get("/{ticket_id}/items")
async def list_ticket_items(
    ticket_id: UUID,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """
    Returns all items linked to a ticket, including item metadata and
    the estimated price that was captured when the item was added.
    """
    # Verify access — non-admins can only view their assigned tickets
    ticket = supabase.table("tickets").select("id, assigned_to").eq("id", str(ticket_id)).single().execute()
    if not ticket.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    if current_user.role != "admin" and ticket.data["assigned_to"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to you.")

    result = (
        supabase.table("ticket_items")
        .select("*, items(id, name, unit, category)")
        .eq("ticket_id", str(ticket_id))
        .order("added_at")
        .execute()
    )
    return result.data


@router.post("/{ticket_id}/items", status_code=status.HTTP_201_CREATED)
async def add_ticket_item(
    ticket_id: UUID,
    body: TicketItemAdd,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """
    Adds an item to the ticket cart.
    Fetches the most recent recorded price for this item (any provider) as
    the estimated_price. If no price has ever been recorded, estimated_price
    is null — the requisition will flag these items as 'sin precio'.
    """
    # Verify ticket exists and user has access
    ticket = supabase.table("tickets").select("id, assigned_to, status").eq("id", str(ticket_id)).single().execute()
    if not ticket.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    if current_user.role != "admin" and ticket.data["assigned_to"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to you.")

    # Lookup the lowest recorded price for this item across all providers.
    # We pick the cheapest available, not the most recent — better for budgeting.
    price_result = (
        supabase.table("item_prices")
        .select("price")
        .eq("item_id", str(body.item_id))
        .order("price")   # ascending → lowest first
        .limit(1)
        .execute()
    )
    estimated_price = price_result.data[0]["price"] if price_result.data else None

    payload = {
        "ticket_id": str(ticket_id),
        "item_id": str(body.item_id),
        "qty": body.qty,
        "estimated_price": estimated_price,
        "added_by": str(current_user.id),
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.notes:
        payload["notes"] = body.notes

    result = supabase.table("ticket_items").insert(payload).execute()
    return result.data[0]


@router.delete("/{ticket_id}/items/{ticket_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_ticket_item(
    ticket_id: UUID,
    ticket_item_id: UUID,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Removes an item from the ticket cart (admin only)."""
    result = (
        supabase.table("ticket_items")
        .delete()
        .eq("id", str(ticket_item_id))
        .eq("ticket_id", str(ticket_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found on this ticket.")


@router.get("/{ticket_id}/requisition")
async def get_requisition(
    ticket_id: UUID,
    _admin: Annotated[UserProfile, Depends(require_admin)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """
    Generates a purchase requisition for a ticket.

    Groups items by their suggested provider (lowest recorded price).
    For each provider group, returns the list of items with qty, unit,
    estimated_price, and subtotal. Also returns items with no price data
    in a separate 'sin_precio' list so the admin knows what needs quoting.

    Response shape:
    {
      ticket_id: str,
      groups: [
        {
          provider: { id, name, phone, whatsapp },
          items: [{ item_id, name, unit, qty, unit_price, subtotal, notes }],
          group_total: float
        }
      ],
      sin_precio: [{ item_id, name, unit, qty }],
      grand_total: float
    }
    """
    ticket = supabase.table("tickets").select("id, title").eq("id", str(ticket_id)).single().execute()
    if not ticket.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    # Fetch all ticket items with item metadata
    items_result = (
        supabase.table("ticket_items")
        .select("*, items(id, name, unit, category)")
        .eq("ticket_id", str(ticket_id))
        .order("added_at")
        .execute()
    )
    ticket_items = items_result.data

    if not ticket_items:
        return {
            "ticket_id": str(ticket_id),
            "ticket_title": ticket.data["title"],
            "groups": [],
            "sin_precio": [],
            "grand_total": 0.0,
        }

    # For each item, find the cheapest price + the provider who offers it.
    # We query item_prices here instead of relying on a stored provider column
    # so that the requisition always reflects the current best price.
    item_ids = [ti["item_id"] for ti in ticket_items]
    prices_result = (
        supabase.table("item_prices")
        .select("item_id, price, provider_id")
        .in_("item_id", item_ids)
        .order("price")   # ascending — cheapest first per item
        .execute()
    )

    # Build best-price map: item_id → { price, provider_id }
    # Because results are ordered cheapest first, first occurrence wins.
    best_price_map: dict = {}
    for row in prices_result.data:
        iid = row["item_id"]
        if iid not in best_price_map:
            best_price_map[iid] = {"price": float(row["price"]), "provider_id": row["provider_id"]}

    # Collect unique provider IDs from best-price map
    provider_ids = list({v["provider_id"] for v in best_price_map.values()})
    providers_map: dict = {}
    if provider_ids:
        providers_result = (
            supabase.table("providers")
            .select("id, name, phone, whatsapp, zone")
            .in_("id", provider_ids)
            .execute()
        )
        providers_map = {p["id"]: p for p in providers_result.data}

    # Build provider groups
    groups_map: dict = {}
    unpriced = []

    for ti in ticket_items:
        item_name = ti["items"]["name"] if ti.get("items") else "—"
        item_unit = ti["items"]["unit"] if ti.get("items") else "—"
        qty = float(ti["qty"])
        best = best_price_map.get(ti["item_id"])

        if not best:
            # No price has ever been recorded for this item
            unpriced.append({
                "ticket_item_id": ti["id"],
                "item_id": ti["item_id"],
                "name": item_name,
                "unit": item_unit,
                "qty": qty,
                "notes": ti.get("notes"),
            })
            continue

        pid = best["provider_id"]
        unit_price = best["price"]
        subtotal = round(qty * unit_price, 2)

        if pid not in groups_map:
            provider_info = providers_map.get(pid, {
                "id": pid, "name": "Proveedor desconocido",
                "phone": None, "whatsapp": None, "zone": None,
            })
            groups_map[pid] = {
                "provider": provider_info,
                "items": [],
                "group_total": 0.0,
            }

        groups_map[pid]["group_total"] = round(groups_map[pid]["group_total"] + subtotal, 2)
        groups_map[pid]["items"].append({
            "ticket_item_id": ti["id"],
            "item_id": ti["item_id"],
            "name": item_name,
            "unit": item_unit,
            "qty": qty,
            "unit_price": unit_price,
            "subtotal": subtotal,
            "notes": ti.get("notes"),
        })

    grand_total = round(sum(g["group_total"] for g in groups_map.values()), 2)

    return {
        "ticket_id": str(ticket_id),
        "ticket_title": ticket.data["title"],
        "groups": list(groups_map.values()),
        "sin_precio": unpriced,
        "grand_total": grand_total,
    }


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
