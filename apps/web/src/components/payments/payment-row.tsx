// Renders a single payment row inside the payments table.
// The backend JOIN gives us lease → room → tenant, so we get room_number
// and tenant name without extra API calls.
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateMX } from "@maya/utils";
import type { Payment, PaymentStatus } from "@maya/types";

// Extended type — the backend returns nested join data the base Payment DTO omits.
export interface PaymentWithContext extends Payment {
  leases?: {
    monthly_rate: number;
    payment_day: number;
    rooms?: { room_number: string; section: string | null; building_id: string };
    user_profiles?: { first_name: string; last_name: string };
  };
}

// Status → label + Tailwind classes for the badge
const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  overdue: { label: "Vencido",   className: "bg-red-100 text-red-800 hover:bg-red-100" },
  paid:    { label: "Pagado",    className: "bg-green-100 text-green-800 hover:bg-green-100" },
  partial: { label: "Parcial",   className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  waived:  { label: "Condonado", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

interface PaymentRowProps {
  payment: PaymentWithContext;
}

export function PaymentRow({ payment }: PaymentRowProps) {
  const cfg = statusConfig[payment.status] ?? statusConfig.pending;
  const room = payment.leases?.rooms;
  const tenant = payment.leases?.user_profiles;

  // Format amount as MXN — backend stores as float (pesos, not centavos)
  const amountFormatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(payment.amount);

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40 transition-colors">
      {/* Room */}
      <td className="px-4 py-3 text-sm font-medium">
        {room ? `Hab. ${room.room_number}` : <span className="text-muted-foreground">—</span>}
      </td>

      {/* Tenant */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {tenant
          ? `${tenant.first_name} ${tenant.last_name}`
          : <span>—</span>}
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-sm font-semibold tabular-nums">
        {amountFormatted}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant="secondary" className={cn(cfg.className)}>
          {cfg.label}
        </Badge>
      </td>

      {/* Due date */}
      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
        {formatDateMX(payment.due_date)}
      </td>

      {/* Paid at — only shown when status = paid */}
      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
        {payment.paid_at ? formatDateMX(payment.paid_at) : <span className="text-muted-foreground/50">—</span>}
      </td>

      {/* Receipt link — visible when Stripe receipt URL is available */}
      <td className="px-4 py-3 text-sm">
        {payment.receipt_url ? (
          <a
            href={payment.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Recibo
          </a>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
    </tr>
  );
}
