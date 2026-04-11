import { Suspense } from "react";
import type { Metadata } from "next";
import { IncidentGrid } from "@/components/incidents/incident-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Incidentes — Maya",
};

export default function IncidentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Incidentes</h1>
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-xl"/>)}</div>}>
        <IncidentGrid />
      </Suspense>
    </div>
  );
}
