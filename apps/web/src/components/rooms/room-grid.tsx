"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildingsApi } from "@maya/api-client";
import type { Room, RoomStatus } from "@maya/types";
import { RoomCard } from "./room-card";
import { StatusFilter } from "./status-filter";
import { Skeleton } from "@/components/ui/skeleton";

export function RoomGrid({ buildingId }: { buildingId: string }) {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") as RoomStatus | null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    buildingsApi
      .getRooms(buildingId, statusFilter ?? undefined)
      .then(setRooms)
      .catch(() => setError("Error al cargar las habitaciones"))
      .finally(() => setLoading(false));
  }, [buildingId, statusFilter]);

  return (
    <div className="space-y-4">
      <StatusFilter />

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!loading && !error && rooms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay habitaciones con este filtro.
        </p>
      )}

      {!loading && !error && rooms.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
