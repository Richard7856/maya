"use client";

/**
 * TicketSheet — slide-over panel que muestra el detalle completo de un ticket
 * y permite cambiar su status directamente desde el dashboard.
 *
 * Arquitectura:
 * - El estado del ticket seleccionado vive en TicketGrid (el padre).
 * - TicketSheet solo recibe el ticket y callbacks; no hace fetch propio.
 * - El cambio de status llama ticketsApi.updateStatus() y devuelve el objeto
 *   actualizado via onUpdated() para que TicketGrid actualice su lista local
 *   sin necesidad de re-fetch completo.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ticketsApi } from "@maya/api-client";
import type { Ticket, TicketStatus } from "@maya/types";
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

// ─── Shared config (duplicated from ticket-card to avoid coupling) ────────────
// Duplicamos en vez de exportar desde ticket-card.tsx para que cada archivo
// sea autocontenido — si ticket-card cambia de estilos no afecta el sheet.

const STATUS_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  open:        { label: "Abierto",      className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  assigned:    { label: "Asignado",     className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" },
  in_progress: { label: "En progreso",  className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  resolved:    { label: "Resuelto",     className: "bg-green-100 text-green-800 hover:bg-green-100" },
  closed:      { label: "Cerrado",      className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

// Flujo de transiciones permitidas por status actual.
// Admin puede mover a cualquier status; la UI muestra solo las opciones relevantes.
// (El backend también valida esto, pero la UI anticipa el flujo correcto.)
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:        ["assigned", "in_progress", "closed"],
  assigned:    ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved:    ["closed"],
  closed:      [],          // terminal — no hay más transiciones
};

// ─── Types ────────────────────────────────────────────────────────────────────

// El backend devuelve rooms y user_profiles como JOINs; los declaramos aquí.
export interface TicketWithContext extends Ticket {
  rooms?: { room_number: string; building_id: string };
  user_profiles?: { first_name: string; last_name: string };
}

interface TicketSheetProps {
  ticket: TicketWithContext | null;   // null = cerrado
  onClose: () => void;
  onUpdated: (updated: TicketWithContext) => void;  // para actualizar la lista local
}

// ─── Row helper interno ───────────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────────────
export function TicketSheet({ ticket, onClose, onUpdated }: TicketSheetProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cambia el status del ticket via API y notifica al padre con el objeto actualizado.
  // Usamos optimistic-like UX: el botón muestra spinner mientras espera.
  async function handleStatusChange(newStatus: TicketStatus) {
    if (!ticket) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await ticketsApi.updateStatus(ticket.id, newStatus);
      // Propagamos el ticket actualizado manteniendo los campos de JOIN
      // que el backend no devuelve en el PATCH (rooms, user_profiles).
      onUpdated({ ...ticket, ...updated });
    } catch {
      setError("No se pudo actualizar el status. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const currentStatus = ticket ? STATUS_CONFIG[ticket.status] : null;
  const transitions = ticket ? ALLOWED_TRANSITIONS[ticket.status] : [];

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

        {/* ── Body — detalles del ticket ─────────────────────────────────── */}
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

              {/* Descripción — ocupa el ancho completo */}
              {ticket.description && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Descripción
                  </span>
                  <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed">
                    {ticket.description}
                  </p>
                </div>
              )}

              {/* Asignado a */}
              {ticket.assigned_to && (
                <DetailRow label="Asignado a" value={ticket.assigned_to} />
              )}

              {/* Cambiar status */}
              {transitions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cambiar status
                  </span>
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
                  {/* Error en línea para no ocultar el spinner del botón */}
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              )}

              {/* Status terminal — sin más acciones posibles */}
              {transitions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Este ticket está cerrado y no admite más cambios de status.
                </p>
              )}
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
