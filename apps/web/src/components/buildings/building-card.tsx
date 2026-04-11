import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Building } from "@maya/types";

export function BuildingCard({ building }: { building: Building }) {
  return (
    <Link href={`/buildings/${building.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">{building.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{building.address}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{building.city}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
