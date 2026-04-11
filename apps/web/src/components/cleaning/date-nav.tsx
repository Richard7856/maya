"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DateNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().split("T")[0];
  const current = searchParams.get("date") || today;

  function navigate(date: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.push(`?${params.toString()}`);
  }

  function shift(days: number) {
    const d = new Date(current + "T12:00:00");
    d.setDate(d.getDate() + days);
    navigate(d.toISOString().split("T")[0]);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" onClick={() => shift(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        value={current}
        onChange={(e) => navigate(e.target.value)}
        className="w-40"
      />
      <Button variant="outline" size="icon-sm" onClick={() => shift(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
