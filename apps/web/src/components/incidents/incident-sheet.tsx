"use client";

/**
 * IncidentSheet — slide-over con detalle completo de un incidente.
 *
 * Capacidades del panel:
 * 1. Ver todos los campos del incidente (categoría, prioridad, habitación, fechas)
 * 2. Cambiar status via incidentsApi.update() — mismo patrón que TicketSheet
 * 3. Agregar una nota de seguimiento via incidentsApi.addUpdate()
 *
 * La nota se envía con el status actual para que el backend registre el historial
 * correctamente. El campo de nota se limpia después de enviar.
 *
 * Flujo de actualización:
 * - onUpdated(updatedIncident) → IncidentGrid reemplaza en lista local (sin re-fetch)
 * - El campo de nota queda vacío pero el sheet permanece abierto
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { incidentsApi } from "@maya/api-client";
import type { Incident, IncidentStatus, IncidentCategory } from "@maya/types";
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

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IncidentStatus, { label: string; className: string }> = {
  open:        { label: "Abierto",      className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  in_progress: { label: "En progreso",  className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  resolved:    { label: "Resuelto",     className: "bg-green-100 text-green-800 hover:bg-green-100" },
  closed:      { label: "Cerrado",      className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  plumbing:    "Plomería",
  electrical:  "Eléctrico",
  structural:  "Estructural",
  appliance:   "Electrodoméstico",
  other:       "Otro",
};

// Transiciones permitidas — igual que el resto: solo mostramos acciones válidas
// para el status actual, evitando que el admin genere estados inválidos.
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open:        ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved:    ["closed"],
  closed:      [],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncidentWithContext extends Incident {
  rooms?: { room_number: string; building_id: string };
}

interface IncidentSheetProps {
  incident: IncidentWithContext | null;  // null = cerrado
  onClose: () => void;
  onUpdated: (updated: IncidentWithContext) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

export function IncidentSheet({ incident, onClose, onUpdated }: IncidentSheetProps) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote]     = useState(false);
  const [note, setNote]                 = useState("");
  const [statusError, setStatusError]   = useState<string | null>(null);
  const [noteError, setNoteError]       = useState<string | null>(null);
  const [noteSent, setNoteSent]         = useState(false);  // feedback visual tras envío

  // Cambia el status del incidente y propaga el objeto actualizado al padre.
  // Se usa update() (PUT) porque el backend de incidents no tiene PATCH /status
  // separado como tickets; update() acepta { status } como campo parcial.
  async function handleStatusChange(newStatus: IncidentStatus) {
    if (!incident) return;
    setStatusError(null);
    setSavingStatus(true);
    try {
      const updated = await incidentsApi.update(incident.id, { status: newStatus });
      onUpdated({ ...incident, ...updated });
    } catch {
      setStatusError("No se pudo actualizar el status. Intenta de nuevo.");
    } finally {
      setSavingStatus(false);
    }
  }

  // Envía una nota de seguimiento. El backend registra la nota con el status
  // actual del incidente para mantener historial auditable.
  async function handleAddNote() {
    if (!incident || !note.trim()) return;
    setNoteError(null);
    setNoteSent(false);
    setSavingNote(true);
    try {
      await incidentsApi.addUpdate(incident.id, {
        note: note.trim(),
        status_changed_to: incident.status,  // informa al backend el status al momento de la nota
      });
      setNote("");       // limpia el campo
      setNoteSent(true); // feedback visual por 3s
      setTimeout(() => setNoteSent(false), 3000);
    } catch {
      setNoteError("No se pudo enviar la nota. Intenta de nuevo.");
    } finally {
      setSavingNote(false);
    }
  }

  const currentStatus = incident ? STATUS_CONFIG[incident.status] : null;
  const transitions   = incident ? ALLOWED_TRANSITIONS[incident.status] : [];

  return (
    <Sheet open={!!incident} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <SheetTitle className="text-base font-semibold leading-snug">
              {incident?.title}
            </SheetTitle>
            {currentStatus && (
              <Badge variant="secondary" className={cn("shrink-0", currentStatus.className)}>
                {currentStatus.label}
              </Badge>
            )}
          </div>
          {incident && (
            <SheetDescription className="text-xs text-muted-foreground">
              Incidente #{incident.id.slice(0, 8)} · Reportado el {formatDateMX(incident.created_at)}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <SheetBody className="space-y-6">
          {incident && (
            <>
              {/* Campos principales en grid de 2 columnas */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow
                  label="Categoría"
                  value={CATEGORY_LABELS[incident.category]}
                />
                <DetailRow
                  label="Prioridad"
                  value={<PriorityBadge priority={incident.priority} />}
                />
                <DetailRow
                  label="Habitación"
                  value={incident.rooms ? `Hab. ${incident.rooms.room_number}` : null}
                />
                <DetailRow
                  label="Costo de reparación"
                  value={
                    incident.repair_cost != null
                      ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(incident.repair_cost)
                      : null
                  }
                />
                {incident.resolved_at && (
                  <DetailRow label="Resuelto el" value={formatDateMX(incident.resolved_at)} />
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Descripción
                </span>
                <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed">
                  {incident.description || <span className="italic text-muted-foreground">Sin descripción</span>}
                </p>
              </div>

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
                        disabled={savingStatus}
                        onClick={() => handleStatusChange(s)}
                        className="gap-1.5"
                      >
                        {savingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
                        {STATUS_CONFIG[s].label}
                      </Button>
                    ))}
                  </div>
                  {statusError && <p className="text-xs text-destructive">{statusError}</p>}
                </div>
              )}

              {transitions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Este incidente está cerrado y no admite más cambios de status.
                </p>
              )}

              {/* Agregar nota de seguimiento */}
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Agregar nota
                </span>
                <textarea
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={3}
                  placeholder="Escribe una actualización o nota para el expediente..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  {/* Feedback inline — evita toasts externos */}
                  <span className={cn("text-xs", noteSent ? "text-green-600" : "text-transparent")}>
                    ✓ Nota registrada
                  </span>
                  {noteError && <p className="text-xs text-destructive">{noteError}</p>}
                  <Button
                    size="sm"
                    disabled={savingNote || !note.trim()}
                    onClick={handleAddNote}
                    className="gap-1.5"
                  >
                    {savingNote && <Loader2 className="h-3 w-3 animate-spin" />}
                    Guardar nota
                  </Button>
                </div>
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
