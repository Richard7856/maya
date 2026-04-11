import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMXN, formatDateMX } from "@maya/utils";
import type { Lease, LeaseStatus } from "@maya/types";

const statusConfig: Record<LeaseStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  ending: { label: "Por terminar", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  terminated: { label: "Terminado", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  eviction: { label: "Desalojo", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

interface LeaseWithRoom extends Lease {
  rooms?: { room_number: string; building_id: string; section?: string };
}

export function LeaseCard({ lease }: { lease: LeaseWithRoom }) {
  const status = statusConfig[lease.status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            {lease.rooms ? `Hab. ${lease.rooms.room_number}` : lease.room_id.slice(0, 8)}
          </CardTitle>
        </div>
        <Badge variant="secondary" className={cn(status.className)}>
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm font-medium">{formatMXN(lease.monthly_rate)}/mes</p>
        <p className="text-xs text-muted-foreground">
          Día de pago: {lease.payment_day}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDateMX(lease.start_date)}
          {lease.end_date ? ` — ${formatDateMX(lease.end_date)}` : " — Sin fecha fin"}
        </p>
      </CardContent>
    </Card>
  );
}
