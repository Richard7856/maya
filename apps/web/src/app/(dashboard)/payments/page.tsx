import { Suspense } from "react";
import type { Metadata } from "next";
import { PaymentGrid } from "@/components/payments/payment-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Pagos — Maya",
};

// Skeleton matches the table shape (rows instead of cards)
function PaymentsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Pagos</h1>
      {/* Suspense required: PaymentGrid uses useSearchParams() which suspends */}
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentGrid />
      </Suspense>
    </div>
  );
}
