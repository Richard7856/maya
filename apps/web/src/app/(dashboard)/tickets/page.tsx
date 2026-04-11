import { Suspense } from "react";
import type { Metadata } from "next";
import { TicketGrid } from "@/components/tickets/ticket-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Tickets — Maya",
};

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-xl"/>)}</div>}>
        <TicketGrid />
      </Suspense>
    </div>
  );
}
