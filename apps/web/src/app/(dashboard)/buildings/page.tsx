import type { Metadata } from "next";
import { BuildingGrid } from "@/components/buildings/building-grid";

export const metadata: Metadata = {
  title: "Edificios — Maya",
};

export default function BuildingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edificios</h1>
      <BuildingGrid />
    </div>
  );
}
