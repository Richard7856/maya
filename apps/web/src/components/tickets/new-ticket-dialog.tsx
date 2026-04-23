"use client";

/**
 * NewTicketDialog — modal para crear un nuevo work order.
 *
 * Carga todas las habitaciones y el personal de limpieza (para asignación)
 * en paralelo al abrirse. El ticket se crea con status 'open';
 * si se asigna pasa a 'assigned' automáticamente (lo maneja el backend).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { buildingsApi, usersApi, ticketsApi } from "@maya/api-client";
import type { RoomWithBuilding } from "@maya/api-client";
import type { Ticket, UserProfile } from "@maya/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCreated: (ticket: Ticket) => void;
}

const PRIORITIES = [
  { value: "low",    label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high",   label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const EMPTY = {
  room_id: "",
  type: "maintenance" as "maintenance" | "cleaning",
  title: "",
  description: "",
  priority: "medium",
  assigned_to: "",
  due_date: "",
};

export function NewTicketDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [rooms, setRooms] = useState<RoomWithBuilding[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load: todas las habitaciones + personal de limpieza
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      buildingsApi.listRooms(),
      usersApi.list({ role: "cleaning" }),
    ])
      .then(([r, s]) => { setRooms(r); setStaff(s); })
      .catch(() => setError("Error al cargar datos."))
      .finally(() => setLoading(false));
  }, [open]);

  function handleClose() {
    setOpen(false);
    setForm(EMPTY);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.room_id || !form.title) return;
    setSaving(true);
    setError(null);
    try {
      const ticket = await ticketsApi.create({
        room_id: form.room_id,
        type: form.type,
        title: form.title,
        description: form.description,
        priority: form.priority as "low" | "medium" | "high" | "urgent",
        assigned_to: form.assigned_to || undefined,
        due_date: form.due_date || undefined,
      });
      onCreated(ticket);
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "No se pudo crear el ticket.");
    } finally {
      setSaving(false);
    }
  }

  const f = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ Nuevo ticket</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-5 text-lg font-semibold">Nuevo ticket</h2>

            {loading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando habitaciones…
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo */}
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <div className="flex gap-2">
                    {(["maintenance", "cleaning"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, type: t }))}
                        className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                          form.type === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted"
                        }`}
                        disabled={saving}
                      >
                        {t === "maintenance" ? "Mantenimiento" : "Limpieza"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Habitación */}
                <div className="space-y-1">
                  <Label>Habitación *</Label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.room_id} onChange={f("room_id")} required disabled={saving}>
                    <option value="">Selecciona habitación</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Hab. {r.room_number}{r.section ? ` — ${r.section}` : ""} · {r.buildings?.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Título */}
                <div className="space-y-1">
                  <Label>Título *</Label>
                  <Input placeholder="ej. Fuga bajo el lavabo" value={form.title} onChange={f("title")} required disabled={saving} />
                </div>

                {/* Descripción */}
                <div className="space-y-1">
                  <Label>Descripción</Label>
                  <textarea
                    className="w-full rounded-md border px-3 py-2 text-sm resize-none"
                    rows={3}
                    placeholder="Describe el problema con detalle…"
                    value={form.description}
                    onChange={f("description")}
                    disabled={saving}
                  />
                </div>

                {/* Prioridad + fecha */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Prioridad</Label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.priority} onChange={f("priority")} disabled={saving}>
                      {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha límite</Label>
                    <Input type="date" value={form.due_date} onChange={f("due_date")} disabled={saving} />
                  </div>
                </div>

                {/* Asignado a */}
                <div className="space-y-1">
                  <Label>Asignar a</Label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.assigned_to} onChange={f("assigned_to")} disabled={saving}>
                    <option value="">Sin asignar</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving || !form.room_id || !form.title}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando…</> : "Crear ticket"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
