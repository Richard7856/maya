"use client";

import { useEffect, useState } from "react";
import { buildingsApi } from "@maya/api-client";
import type { Building } from "@maya/types";
import { BuildingCard } from "./building-card";
import { Skeleton } from "@/components/ui/skeleton";

export function BuildingGrid() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buildingsApi
      .list()
      .then(setBuildings)
      .catch(() => setError("Error al cargar los edificios"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (buildings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay edificios registrados.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {buildings.map((building) => (
        <BuildingCard key={building.id} building={building} />
      ))}
    </div>
  );
}
