import { Suspense } from "react";
import type { Metadata } from "next";
import { AssignmentGrid } from "@/components/cleaning/assignment-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Limpieza — Maya",
};

export default function CleaningPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Limpieza</h1>
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-xl"/>)}</div>}>
        <AssignmentGrid />
      </Suspense>
    </div>
  );
}
