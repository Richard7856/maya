"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { leasesApi } from "@maya/api-client";
import type { Lease, LeaseStatus } from "@maya/types";
import { LeaseCard } from "./lease-card";
import { LeaseStatusFilter } from "./lease-status-filter";
import { NewLeaseDialog } from "./new-lease-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function LeaseGrid() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") as LeaseStatus | null;

  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    leasesApi
      .list({ status: statusFilter || undefined })
      .then(setLeases)
      .catch(() => setError("Error al cargar los contratos"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LeaseStatusFilter />
        <NewLeaseDialog onCreated={(lease) => setLeases((prev) => [lease, ...prev])} />
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && leases.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay contratos registrados.</p>
      )}

      {!loading && !error && leases.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leases.map((lease) => (
            <LeaseCard key={lease.id} lease={lease} />
          ))}
        </div>
      )}
    </div>
  );
}
