"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const filters = [
  { value: "all", label: "Todos" },
  { value: "admin", label: "Admin" },
  { value: "tenant", label: "Inquilino" },
  { value: "cleaning", label: "Limpieza" },
  { value: "security", label: "Seguridad" },
];

export function RoleFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("role") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("role");
    } else {
      params.set("role", value);
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
