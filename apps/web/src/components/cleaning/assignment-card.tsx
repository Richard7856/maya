import { SprayCan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CleaningAssignment, CleaningAssignmentStatus } from "@maya/types";
import { TIME_BLOCK_LABELS } from "@maya/types";
import type { TimeBlock } from "@maya/types";

const statusConfig: Record<CleaningAssignmentStatus, { label: string; className: string }> = {
  scheduled: { label: "Programado", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  confirmed: { label: "Confirmado", className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" },
  in_progress: { label: "En progreso", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  completed: { label: "Completado", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  missed: { label: "No asistió", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  late: { label: "Tardío", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
};

interface AssignmentWithRoom extends CleaningAssignment {
  rooms?: { room_number: string; building_id: string };
}

export function AssignmentCard({ assignment }: { assignment: AssignmentWithRoom }) {
  const status = statusConfig[assignment.status];
  const timeLabel = TIME_BLOCK_LABELS[assignment.time_block as TimeBlock];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <SprayCan className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            {assignment.rooms ? `Hab. ${assignment.rooms.room_number}` : assignment.room_id.slice(0, 8)}
          </CardTitle>
        </div>
        <Badge variant="secondary" className={cn(status.className)}>
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm font-medium">{timeLabel}</p>
        <p className="text-xs text-muted-foreground">{assignment.scheduled_date}</p>
      </CardContent>
    </Card>
  );
}
