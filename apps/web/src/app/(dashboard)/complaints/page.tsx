"use client";

/**
 * Complaints — vista de quejas anónimas de inquilinos.
 *
 * Usa la vista complaints_safe del backend que oculta tenant_id
 * cuando is_anonymous=TRUE. El admin nunca ve quién envió una queja anónima.
 * Solo puede cambiar el status para dar seguimiento.
 */
import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { complaintsApi } from "@maya/api-client";
import type { Complaint, ComplaintStatus } from "@maya/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; className: string }> = {
  open:          { label: "Nueva",          className: "bg-red-100 text-red-800" },
  investigating: { label: "Investigando",   className: "bg-amber-100 text-amber-800" },
  resolved:      { label: "Resuelta",       className: "bg-green-100 text-green-800" },
  closed:        { label: "Cerrada",        className: "bg-gray-100 text-gray-800" },
};

const TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  open:          ["investigating", "resolved"],
  investigating: ["resolved", "closed"],
  resolved:      ["closed"],
  closed:        [],
};

const FILTER_OPTIONS: { value: ComplaintStatus | ""; label: string }[] = [
  { value: "",             label: "Todas" },
  { value: "open",         label: "Nuevas" },
  { value: "investigating",label: "Investigando" },
  { value: "resolved",     label: "Resueltas" },
  { value: "closed",       label: "Cerradas" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ComplaintStatus | "">("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    complaintsApi
      .list({ status: filter || undefined })
      .then(setComplaints)
      .catch(() => setError("Error al cargar las quejas."))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(complaint: Complaint, newStatus: ComplaintStatus) {
    setUpdating(complaint.id);
    try {
      const updated = await complaintsApi.updateStatus(complaint.id, newStatus);
      setComplaints((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    } catch {
      setError("No se pudo actualizar el status.");
    } finally {
      setUpdating(null);
    }
  }

  const open  = complaints.filter((c) => c.status === "open").length;
  const inProgress = complaints.filter((c) => c.status === "investigating").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quejas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Las quejas anónimas no muestran la identidad del inquilino.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* KPI pills */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-red-50 px-4 py-2">
          <MessageSquareWarning className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-800">{open} nuevas</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-amber-50 px-4 py-2">
          <Loader2 className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">{inProgress} en proceso</span>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
              filter === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted border-transparent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 text-green-400" />
          <p className="text-base font-medium">Sin quejas{filter ? " con este filtro" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const cfg = STATUS_CONFIG[c.status];
            const transitions = TRANSITIONS[c.status];
            return (
              <div key={c.id} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Ícono de anonimato */}
                    {c.is_anonymous && (
                      <span title="Queja anónima" className="shrink-0 text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.rooms ? `Hab. ${c.rooms.room_number} · ${c.rooms.buildings?.name ?? ""}` : "—"} · {formatDate(c.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={`shrink-0 text-xs ${cfg.className}`}>
                    {cfg.label}
                  </Badge>
                </div>

                {c.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-lg px-3 py-2">
                    {c.description}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {c.category}
                  </span>

                  {transitions.length > 0 && (
                    <div className="flex gap-2">
                      {transitions.map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={updating === c.id}
                          onClick={() => handleStatusChange(c, s)}
                        >
                          {updating === c.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          {STATUS_CONFIG[s].label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
