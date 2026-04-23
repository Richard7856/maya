"use client";

import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { EditRoomDialog } from "./edit-room-dialog";
import { formatMXN } from "@maya/utils";
import type { Room } from "@maya/types";

interface Props {
  room: Room;
  buildingId: string;
  onUpdated: (room: Room) => void;
}

export function RoomCard({ room, buildingId, onUpdated }: Props) {
  const [current, setCurrent] = useState(room);

  const handleUpdated = (updated: Room) => {
    setCurrent(updated);
    onUpdated(updated);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{current.room_number}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge status={current.status} />
          <EditRoomDialog
            buildingId={buildingId}
            room={current}
            onUpdated={handleUpdated}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {current.section && (
          <p className="text-sm text-muted-foreground">{current.section}</p>
        )}
        <p className="text-sm font-medium">{formatMXN(current.monthly_rate)}/mes</p>
      </CardContent>
    </Card>
  );
}
