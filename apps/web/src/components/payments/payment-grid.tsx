"use client";

// Uses a <table> instead of cards — payments have 6+ columns that don't fit a card.
// Follows the same useEffect + useState fetch pattern as every other grid in this app.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { paymentsApi } from "@maya/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusFilter } from "./payment-status-filter";
import { PaymentRow, type PaymentWithContext } from "./payment-row";

const TABLE_HEADERS = ["Habitación", "Inquilino", "Monto", "Estado", "Vence", "Pagado", "Recibo"];

export function PaymentGrid() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");

  const [payments, setPayments] = useState<PaymentWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    paymentsApi
      .list({ status: statusFilter || undefined })
      .then((data) => setPayments(data as PaymentWithContext[]))
      .catch(() => setError("Error al cargar los pagos"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-4">
      <PaymentStatusFilter />

      {/* Skeleton while loading — row-based to match the table shape */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && payments.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
      )}

      {!loading && !error && payments.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left">
            <thead className="border-b bg-muted/50">
              <tr>
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Row count — useful for quick overviews */}
      {!loading && payments.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {payments.length} pago{payments.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
