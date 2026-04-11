import { Suspense } from "react";
import type { Metadata } from "next";
import { LeaseGrid } from "@/components/leases/lease-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Contratos — Maya",
};

export default function LeasesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-xl"/>)}</div>}>
        <LeaseGrid />
      </Suspense>
    </div>
  );
}
