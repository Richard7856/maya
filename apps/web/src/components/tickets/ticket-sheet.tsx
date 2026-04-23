"use client";

/**
 * TicketSheet — slide-over panel que muestra el detalle completo de un ticket,
 * permite cambiar status y gestionar el carrito de artículos (Phase 2).
 *
 * Arquitectura:
 * - El estado del ticket seleccionado vive en TicketGrid (el padre).
 * - TicketSheet solo recibe el ticket y callbacks; el fetch de items es local.
 * - El carrito se carga lazy cuando el usuario abre la sección de artículos.
 * - La requisición se genera on-demand con el botón "Ver requisición".
 */
import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, ShoppingCart, FileText, AlertTriangle } from "lucide-react";
import { ticketsApi, itemsApi } from "@maya/api-client";
import type { Ticket, TicketStatus } from "@maya/types";
import type { TicketItem, Requisition } from "@maya/api-client";
import type { Item } from "@maya/api-client";
import { formatDateMX } from "@maya/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { cn } from "@/lib/utils";

// ─── Shared config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  open:        { label: "Abierto",      className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  assigned:    { label: "Asignado",     className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" },
  in_progress: { label: "En progreso",  className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  resolved:    { label: "Resuelto",     className: "bg-green-100 text-green-800 hover:bg-green-100" },
  closed:      { label: "Cerrado",      className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:        ["assigned", "in_progress", "closed"],
  assigned:    ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved:    ["closed"],
  closed:      [],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TicketWithContext extends Ticket {
  rooms?: { room_number: string; building_id: string };
  user_profiles?: { first_name: string; last_name: string };
}

interface TicketSheetProps {
  ticket: TicketWithContext | null;
  onClose: () => void;
  onUpdated: (updated: TicketWithContext) => void;
}

// ─── Helper components ────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

// ─── Requisition view (rendered inline when loaded) ───────────────────────────

function RequisitionView({ req }: { req: Requisition }) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Requisición de compra</p>
        <p className="text-sm font-semibold text-emerald-700">
          Total: ${req.grand_total.toFixed(2)} MXN
        </p>
      </div>

      {req.groups.map((group) => (
        <div key={group.provider.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground">
              {group.provider.name}
              {group.provider.phone && (
                <a href={`tel:${group.provider.phone}`} className="ml-2 text-blue-600 hover:underline">
                  {group.provider.phone}
                </a>
              )}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-1">
            {group.items.map((item) => (
              <div key={item.ticket_item_id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-foreground">{item.name}</span>
                <span className="text-muted-foreground">{item.qty} {item.unit}</span>
                <span className="text-muted-foreground">× ${item.unit_price.toFixed(2)}</span>
                <span className="w-20 text-right font-medium">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-end border-t pt-1 text-xs font-semibold">
              Subtotal: ${group.group_total.toFixed(2)}
            </div>
          </div>
        </div>
      ))}

      {req.sin_precio.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sin precio registrado — cotizar manualmente
          </div>
          {req.sin_precio.map((item) => (
            <div key={item.ticket_item_id} className="flex gap-2 text-xs text-amber-700">
              <span className="flex-1">{item.name}</span>
              <span>{item.qty} {item.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketSheet({ ticket, onClose, onUpdated }: TicketSheetProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<TicketItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // Add item UI
  const [showAddItem, setShowAddItem] = useState(false);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemNotes, setItemNotes] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Requisition
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [reqLoading, setReqLoading] = useState(false);

  // Load cart items when a ticket is selected
  const loadCart = useCallback(async () => {
    if (!ticket) return;
    setCartLoading(true);
    setCartError(null);
    try {
      const items = await ticketsApi.listItems(ticket.id);
      setCartItems(items);
    } catch {
      setCartError("No se pudieron cargar los artículos.");
    } finally {
      setCartLoading(false);
    }
  }, [ticket?.id]);

  // Reload cart on ticket change; reset requisition
  useEffect(() => {
    if (ticket) {
      loadCart();
      setRequisition(null);
      setShowAddItem(false);
    } else {
      setCartItems([]);
    }
  }, [ticket?.id]);

  // Load available items for the add-item dropdown (lazy, once)
  useEffect(() => {
    if (showAddItem && availableItems.length === 0) {
      itemsApi.list({ active_only: true }).then(setAvailableItems).catch(() => {});
    }
  }, [showAddItem]);

  async function handleStatusChange(newStatus: TicketStatus) {
    if (!ticket) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await ticketsApi.updateStatus(ticket.id, newStatus);
      onUpdated({ ...ticket, ...updated });
    } catch {
      setError("No se pudo actualizar el status. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !selectedItemId) return;
    setAddingItem(true);
    try {
      await ticketsApi.addItem(ticket.id, {
        item_id: selectedItemId,
        qty: parseFloat(itemQty) || 1,
        notes: itemNotes || undefined,
      });
      setSelectedItemId("");
      setItemQty("1");
      setItemNotes("");
      setShowAddItem(false);
      setRequisition(null); // requisition is now stale
      loadCart();
    } catch {
      setCartError("No se pudo agregar el artículo.");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleRemoveItem(ticketItemId: string) {
    if (!ticket) return;
    try {
      await ticketsApi.removeItem(ticket.id, ticketItemId);
      setRequisition(null);
      loadCart();
    } catch {
      setCartError("No se pudo eliminar el artículo.");
    }
  }

  async function handleLoadRequisition() {
    if (!ticket) return;
    setReqLoading(true);
    try {
      const req = await ticketsApi.getRequisition(ticket.id);
      setRequisition(req);
    } catch {
      setCartError("No se pudo generar la requisición.");
    } finally {
      setReqLoading(false);
    }
  }

  const currentStatus = ticket ? STATUS_CONFIG[ticket.status] : null;
  const transitions = ticket ? ALLOWED_TRANSITIONS[ticket.status] : [];
  const cartTotal = cartItems.reduce((sum, ti) => sum + (ti.estimated_price ? ti.estimated_price * ti.qty : 0), 0);

  return (
    <Sheet open={!!ticket} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <SheetTitle className="text-base font-semibold leading-snug">
              {ticket?.title}
            </SheetTitle>
            {currentStatus && (
              <Badge variant="secondary" className={cn("shrink-0", currentStatus.className)}>
                {currentStatus.label}
              </Badge>
            )}
          </div>
          {ticket && (
            <SheetDescription className="text-xs text-muted-foreground">
              Ticket #{ticket.id.slice(0, 8)} · Creado el {formatDateMX(ticket.created_at)}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <SheetBody className="space-y-6">
          {ticket && (
            <>
              {/* Campos principales */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Tipo" value={ticket.type === "cleaning" ? "Limpieza" : "Mantenimiento"} />
                <DetailRow label="Prioridad" value={<PriorityBadge priority={ticket.priority} />} />
                <DetailRow
                  label="Habitación"
                  value={ticket.rooms ? `Hab. ${ticket.rooms.room_number}` : null}
                />
                <DetailRow
                  label="Vence"
                  value={ticket.due_date ? formatDateMX(ticket.due_date) : null}
                />
              </div>

              {ticket.description && (
                <div className="space-y-1.5">
                  <SectionTitle>Descripción</SectionTitle>
                  <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed">
                    {ticket.description}
                  </p>
                </div>
              )}

              {/* Foto de evidencia — subida por cleaning staff al reportar el desperfecto */}
              {ticket.evidence_url && (
                <div className="space-y-1.5">
                  <SectionTitle>Evidencia fotográfica</SectionTitle>
                  <a
                    href={ticket.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                    title="Ver foto completa"
                  >
                    <img
                      src={ticket.evidence_url}
                      alt="Evidencia del desperfecto"
                      className="w-full max-h-52 rounded-lg object-cover border cursor-zoom-in hover:opacity-90 transition-opacity"
                    />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Haz clic en la foto para verla en tamaño completo
                  </p>
                </div>
              )}

              {ticket.assigned_to && (
                <DetailRow label="Asignado a" value={ticket.assigned_to} />
              )}

              {/* Status transitions */}
              {transitions.length > 0 && (
                <div className="space-y-2">
                  <SectionTitle>Cambiar status</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => handleStatusChange(s)}
                        className="gap-1.5"
                      >
                        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {STATUS_CONFIG[s].label}
                      </Button>
                    ))}
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              )}

              {transitions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Este ticket está cerrado y no admite más cambios de status.
                </p>
              )}

              {/* ── Cart section ─────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SectionTitle>Artículos</SectionTitle>
                    {cartItems.length > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {cartItems.length}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setShowAddItem((v) => !v)}
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </Button>
                </div>

                {cartError && (
                  <p className="text-xs text-destructive">{cartError}</p>
                )}

                {/* Add item form */}
                {showAddItem && (
                  <form onSubmit={handleAddItem} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <select
                      className="w-full rounded-md border px-2 py-1.5 text-xs"
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      required
                      disabled={addingItem}
                    >
                      <option value="">Selecciona artículo…</option>
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                        className="w-20 rounded-md border px-2 py-1.5 text-xs"
                        placeholder="Qty"
                        disabled={addingItem}
                      />
                      <input
                        type="text"
                        value={itemNotes}
                        onChange={(e) => setItemNotes(e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1.5 text-xs"
                        placeholder="Notas (opcional)"
                        disabled={addingItem}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddItem(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" className="h-6 text-xs" disabled={addingItem || !selectedItemId}>
                        {addingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : "Agregar"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Cart list */}
                {cartLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Cargando artículos…
                  </div>
                ) : cartItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Sin artículos. Usa el botón Agregar para vincular materiales.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {cartItems.map((ti) => (
                      <div key={ti.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                        <span className="flex-1 font-medium">
                          {ti.items?.name ?? "Artículo"}
                        </span>
                        <span className="text-muted-foreground">
                          {ti.qty} {ti.items?.unit}
                        </span>
                        {ti.estimated_price != null ? (
                          <span className="w-20 text-right text-muted-foreground">
                            ${(ti.qty * ti.estimated_price).toFixed(2)}
                          </span>
                        ) : (
                          <span className="w-20 text-right text-amber-600 italic">sin precio</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveItem(ti.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Cart summary */}
                    <div className="flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground">Estimado total</span>
                      <span className="font-semibold">${cartTotal.toFixed(2)} MXN</span>
                    </div>
                  </div>
                )}

                {/* Requisition button + view */}
                {cartItems.length > 0 && (
                  <div className="space-y-3">
                    {!requisition ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs"
                        onClick={handleLoadRequisition}
                        disabled={reqLoading}
                      >
                        {reqLoading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <FileText className="h-3.5 w-3.5" />}
                        Generar requisición de compra
                      </Button>
                    ) : (
                      <>
                        <RequisitionView req={requisition} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => setRequisition(null)}
                        >
                          Ocultar requisición
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetBody>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
