import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KpiPanel } from "@/components/buildings/kpi-panel";
import { RoomGrid } from "@/components/rooms/room-grid";
import { Separator } from "@/components/ui/separator";

interface Props {
  params: Promise<{ buildingId: string }>;
}

export const metadata: Metadata = {
  title: "Detalle de Edificio — Maya",
};

export default async function BuildingDetailPage({ params }: Props) {
  const { buildingId } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/buildings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Edificios
        </Link>
      </div>

      <KpiPanel buildingId={buildingId} />

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Habitaciones</h2>
        <RoomGrid buildingId={buildingId} />
      </div>
    </div>
  );
}
