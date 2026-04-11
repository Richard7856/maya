import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IncidentPriority } from "@maya/types";

const priorityConfig: Record<IncidentPriority, { label: string; className: string }> = {
  low: {
    label: "Baja",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
  medium: {
    label: "Media",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  high: {
    label: "Alta",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  urgent: {
    label: "Urgente",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
};

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  const config = priorityConfig[priority];
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
