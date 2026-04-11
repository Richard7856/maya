"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const filters = [
  { value: "all", label: "Todos" },
  { value: "scheduled", label: "Programado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completado" },
  { value: "missed", label: "No asistió" },
  { value: "late", label: "Tardío" },
];

export function AssignmentStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        {filters.map((f) => (
          <TabsTrigger key={f.value} value={f.value}>
            {f.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
