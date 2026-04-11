"use client";

// Mirrors the PaymentStatus enum in @maya/types.
// Tabs drive the ?status= search param — same pattern as other filters in this dashboard.
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const filters = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "overdue", label: "Vencido" },
  { value: "paid", label: "Pagado" },
  { value: "partial", label: "Parcial" },
  { value: "waived", label: "Condonado" },
];

export function PaymentStatusFilter() {
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
