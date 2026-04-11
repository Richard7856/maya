import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { cn } from "@/lib/utils";
import { formatDateMX } from "@maya/utils";
import type { Incident, IncidentStatus, IncidentCategory } from "@maya/types";

const statusConfig: Record<IncidentStatus, { label: string; className: string }> = {
  open: { label: "Abierto", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  in_progress: { label: "En progreso", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  resolved: { label: "Resuelto", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  closed: { label: "Cerrado", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

const categoryLabels: Record<IncidentCategory, string> = {
  plumbing: "Plomería",
  electrical: "Eléctrico",
  structural: "Estructural",
  appliance: "Electrodoméstico",
  other: "Otro",
};

export interface IncidentWithRoom extends Incident {
  rooms?: { room_number: string; building_id: string };
}

interface IncidentCardProps {
  incident: IncidentWithRoom;
  /** Si se pasa, la card se vuelve clickeable y abre el sheet de detalle */
  onClick?: (incident: IncidentWithRoom) => void;
}

export function IncidentCard({ incident, onClick }: IncidentCardProps) {
  const status = statusConfig[incident.status];

  return (
    <Card
      className={cn(onClick && "cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-border")}
      onClick={() => onClick?.(incident)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium leading-tight">
            {incident.title}
          </CardTitle>
        </div>
        <Badge variant="secondary" className={cn(status.className)}>
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <PriorityBadge priority={incident.priority} />
          <Badge variant="outline">{categoryLabels[incident.category]}</Badge>
        </div>
        {incident.rooms && (
          <p className="text-xs text-muted-foreground">Hab. {incident.rooms.room_number}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDateMX(incident.created_at)}</p>
      </CardContent>
    </Card>
  );
}
