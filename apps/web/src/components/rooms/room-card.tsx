import { DoorOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { formatMXN } from "@maya/utils";
import type { Room } from "@maya/types";

export function RoomCard({ room }: { room: Room }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            {room.room_number}
          </CardTitle>
        </div>
        <StatusBadge status={room.status} />
      </CardHeader>
      <CardContent className="space-y-1">
        {room.section && (
          <p className="text-sm text-muted-foreground">{room.section}</p>
        )}
        <p className="text-sm font-medium">{formatMXN(room.monthly_rate)}/mes</p>
      </CardContent>
    </Card>
  );
}
