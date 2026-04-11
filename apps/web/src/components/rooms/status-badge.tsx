import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoomStatus } from "@maya/types";

const statusConfig: Record<RoomStatus, { label: string; className: string }> = {
  vacant: {
    label: "Disponible",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  occupied: {
    label: "Ocupado",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  incoming: {
    label: "Próximo ingreso",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  maintenance: {
    label: "Mantenimiento",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
};

export function StatusBadge({ status }: { status: RoomStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
