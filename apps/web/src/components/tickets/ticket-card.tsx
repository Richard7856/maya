/**
 * TicketCard — muestra un ticket en el grid de lista.
 *
 * Es un componente de presentación puro: no hace fetch, no tiene estado.
 * El onClick opcional permite que el padre (TicketGrid) abra el TicketSheet
 * cuando el usuario hace click en la card.
 */
import { Ticket as TicketIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { cn } from "@/lib/utils";
import { formatDateMX } from "@maya/utils";
import type { Ticket, TicketStatus, TicketType } from "@maya/types";

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  open:        { label: "Abierto",      className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  assigned:    { label: "Asignado",     className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" },
  in_progress: { label: "En progreso",  className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  resolved:    { label: "Resuelto",     className: "bg-green-100 text-green-800 hover:bg-green-100" },
  closed:      { label: "Cerrado",      className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

const typeConfig: Record<TicketType, { label: string; className: string }> = {
  cleaning:    { label: "Limpieza",     className: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
  maintenance: { label: "Mantenimiento", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
};

export interface TicketWithRoom extends Ticket {
  rooms?: { room_number: string; building_id: string };
}

interface TicketCardProps {
  ticket: TicketWithRoom;
  /** Si se pasa, la card se vuelve clickeable y abre el sheet de detalle */
  onClick?: (ticket: TicketWithRoom) => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const status = statusConfig[ticket.status];
  const type = typeConfig[ticket.type];

  return (
    <Card
      // cursor-pointer + ring en hover solo cuando el card es interactivo
      className={cn(onClick && "cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-border")}
      onClick={() => onClick?.(ticket)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <TicketIcon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium leading-tight">
            {ticket.title}
          </CardTitle>
        </div>
        <Badge variant="secondary" className={cn(status.className)}>
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className={cn(type.className)}>
            {type.label}
          </Badge>
          <PriorityBadge priority={ticket.priority} />
        </div>
        {ticket.rooms && (
          <p className="text-xs text-muted-foreground">Hab. {ticket.rooms.room_number}</p>
        )}
        {ticket.due_date && (
          <p className="text-xs text-muted-foreground">Vence: {formatDateMX(ticket.due_date)}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDateMX(ticket.created_at)}</p>
      </CardContent>
    </Card>
  );
}
