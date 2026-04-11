"use client";

import { useEffect, useState } from "react";
import {
  Home,
  DollarSign,
  AlertTriangle,
  Wrench,
  Ticket,
} from "lucide-react";
import { buildingsApi, type BuildingKpis } from "@maya/api-client";
import { formatMXN } from "@maya/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  alert?: boolean;
}

function KpiCard({ title, value, subtitle, icon: Icon, alert }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", alert ? "text-destructive" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", alert && "text-destructive")}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiPanel({ buildingId }: { buildingId: string }) {
  const [kpis, setKpis] = useState<BuildingKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buildingsApi
      .getKpis(buildingId)
      .then(setKpis)
      .catch(() => setError("Error al cargar KPIs"))
      .finally(() => setLoading(false));
  }, [buildingId]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !kpis) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  const occupancyPct = Math.round(kpis.occupancy_rate * 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        title="Ocupación"
        value={`${occupancyPct}%`}
        subtitle={`${kpis.occupied_rooms} de ${kpis.total_rooms} habitaciones`}
        icon={Home}
      />
      <KpiCard
        title="Ingresos mensuales"
        value={formatMXN(kpis.monthly_revenue)}
        icon={DollarSign}
      />
      <KpiCard
        title="Pagos vencidos"
        value={String(kpis.overdue_payments)}
        icon={AlertTriangle}
        alert={kpis.overdue_payments > 0}
      />
      <KpiCard
        title="Incidentes abiertos"
        value={String(kpis.open_incidents)}
        icon={Wrench}
        alert={kpis.open_incidents > 0}
      />
      <KpiCard
        title="Tickets abiertos"
        value={String(kpis.open_tickets)}
        icon={Ticket}
        alert={kpis.open_tickets > 0}
      />
    </div>
  );
}
