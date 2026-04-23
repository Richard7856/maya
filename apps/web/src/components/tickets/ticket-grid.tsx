"use client";

/**
 * TicketGrid — lista de tickets con filtros y slide-over de detalle.
 *
 * Gestión de estado:
 * - `tickets`: lista completa del fetch actual (se actualiza en lugar cuando
 *   el sheet cambia un status, evitando re-fetch completo).
 * - `selectedTicket`: ticket abierto en el TicketSheet; null = cerrado.
 *
 * Flujo de actualización de status:
 * 1. TicketSheet llama onUpdated(updatedTicket)
 * 2. TicketGrid reemplaza el objeto en la lista local (por id)
 * 3. La card en el grid refleja el nuevo status inmediatamente
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ticketsApi } from "@maya/api-client";
import type { TicketStatus, TicketType } from "@maya/types";
import { TicketCard, type TicketWithRoom } from "./ticket-card";
import { TicketFilter } from "./ticket-filter";
import { TicketSheet, type TicketWithContext } from "./ticket-sheet";
import { NewTicketDialog } from "./new-ticket-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function TicketGrid() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") as TicketStatus | null;
  const typeFilter   = searchParams.get("type")   as TicketType   | null;

  const [tickets, setTickets]               = useState<TicketWithContext[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithContext | null>(null);

  useEffect(() => {
    setLoading(true);
    ticketsApi
      .list({
        status: statusFilter || undefined,
        type:   typeFilter   || undefined,
      })
      .then((data) => setTickets(data as TicketWithContext[]))
      .catch(() => setError("Error al cargar los tickets"))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  // Reemplaza el ticket en la lista local sin re-fetch.
  // Esto mantiene la lista actualizada después de un cambio de status en el sheet.
  function handleTicketUpdated(updated: TicketWithContext) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    // Sincronizar también el ticket seleccionado para que el sheet muestre el nuevo status
    setSelectedTicket(updated);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <TicketFilter />
          <NewTicketDialog onCreated={(t) => setTickets((prev) => [t as TicketWithContext, ...prev])} />
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && tickets.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay tickets registrados.</p>
        )}

        {!loading && !error && tickets.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={setSelectedTicket}   // abre el sheet con este ticket
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheet montado fuera del grid para que el z-index no se vea afectado */}
      <TicketSheet
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={handleTicketUpdated}
      />
    </>
  );
}
