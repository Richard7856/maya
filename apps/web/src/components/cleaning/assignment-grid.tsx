"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cleaningApi } from "@maya/api-client";
import type { CleaningAssignment, CleaningAssignmentStatus } from "@maya/types";
import { AssignmentCard } from "./assignment-card";
import { AssignmentStatusFilter } from "./assignment-status-filter";
import { DateNav } from "./date-nav";
import { Skeleton } from "@/components/ui/skeleton";

export function AssignmentGrid() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") as CleaningAssignmentStatus | null;
  const today = new Date().toISOString().split("T")[0];
  const dateFilter = searchParams.get("date") || today;

  const [assignments, setAssignments] = useState<CleaningAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    cleaningApi
      .listAssignments({
        status: statusFilter || undefined,
        date_from: dateFilter,
        date_to: dateFilter,
      })
      .then(setAssignments)
      .catch(() => setError("Error al cargar las asignaciones"))
      .finally(() => setLoading(false));
  }, [statusFilter, dateFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <DateNav />
        <AssignmentStatusFilter />
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && assignments.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay asignaciones para esta fecha.</p>
      )}

      {!loading && !error && assignments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </div>
  );
}
