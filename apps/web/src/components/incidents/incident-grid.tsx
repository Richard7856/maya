"use client";

/**
 * IncidentGrid — lista de incidentes con filtro de status y sheet de detalle.
 *
 * Gestión de estado:
 * - `incidents`: lista completa; se actualiza in-place cuando el sheet cambia status
 *   para reflejar el nuevo estado sin re-fetch completo.
 * - `selectedIncident`: incidente abierto en IncidentSheet; null = cerrado.
 *
 * Flujo de actualización:
 * 1. IncidentSheet llama onUpdated(updatedIncident)
 * 2. IncidentGrid reemplaza el objeto en la lista local (por id)
 * 3. La card refleja el nuevo status inmediatamente
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { incidentsApi } from "@maya/api-client";
import type { IncidentStatus } from "@maya/types";
import { IncidentCard, type IncidentWithRoom } from "./incident-card";
import { IncidentStatusFilter } from "./incident-status-filter";
import { IncidentSheet, type IncidentWithContext } from "./incident-sheet";
import { Skeleton } from "@/components/ui/skeleton";

export function IncidentGrid() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") as IncidentStatus | null;

  const [incidents, setIncidents]               = useState<IncidentWithContext[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithContext | null>(null);

  useEffect(() => {
    setLoading(true);
    incidentsApi
      .list({ status: statusFilter || undefined })
      .then((data) => setIncidents(data as IncidentWithContext[]))
      .catch(() => setError("Error al cargar los incidentes"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  // Reemplaza el incidente en la lista local sin re-fetch.
  // También sincroniza el sheet para que muestre el status actualizado.
  function handleIncidentUpdated(updated: IncidentWithContext) {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedIncident(updated);
  }

  return (
    <>
      <div className="space-y-4">
        <IncidentStatusFilter />

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && incidents.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay incidentes registrados.</p>
        )}

        {!loading && !error && incidents.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident as IncidentWithRoom}
                onClick={setSelectedIncident}   // abre el sheet con este incidente
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheet montado fuera del grid para que el z-index no se vea afectado */}
      <IncidentSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={handleIncidentUpdated}
      />
    </>
  );
}
