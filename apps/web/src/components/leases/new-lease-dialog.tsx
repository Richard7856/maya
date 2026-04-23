"use client";

/**
 * NewLeaseDialog — modal para crear un nuevo contrato de arrendamiento.
 *
 * Carga habitaciones vacant y tenants en paralelo al abrirse (lazy).
 * Al crear el contrato exitosamente, el backend marca la habitación
 * como 'occupied' automáticamente.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { buildingsApi, leasesApi, usersApi } from "@maya/api-client";
import type { RoomWithBuilding } from "@maya/api-client";
import type { Lease, UserProfile } from "@maya/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCreated: (lease: Lease) => void;
}

const EMPTY = {
  room_id: "",
  tenant_id: "",
  start_date: "",
  monthly_rate: "",
  payment_day: "1",
  deposit_amount: "",
  access_code: "",
  wifi_password: "",
};

export function NewLeaseDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [rooms, setRooms] = useState<RoomWithBuilding[]>([]);
  const [tenants, setTenants] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga lazy: rooms vacantes + tenants cuando se abre el modal
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      buildingsApi.listRooms({ status: "vacant" }),
      usersApi.list({ role: "tenant" }),
    ])
      .then(([r, t]) => { setRooms(r); setTenants(t); })
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
    if (!form.room_id || !form.tenant_id || !form.start_date || !form.monthly_rate) return;
    setSaving(true);
    setError(null);
    try {
      const lease = await leasesApi.create({
        room_id: form.room_id,
        tenant_id: form.tenant_id,
        start_date: form.start_date,
        monthly_rate: parseFloat(form.monthly_rate),
        payment_day: parseInt(form.payment_day),
        deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : undefined,
        access_code: form.access_code || undefined,
        wifi_password: form.wifi_password || undefined,
      });
      onCreated(lease);
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "No se pudo crear el contrato.");
    } finally {
      setSaving(false);
    }
  }

  const f = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ Nuevo contrato</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-5 text-lg font-semibold">Nuevo contrato</h2>

            {loading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando habitaciones y tenants…
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Habitación */}
                <div className="space-y-1">
                  <Label>Habitación *</Label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.room_id} onChange={f("room_id")} required disabled={saving}>
                    <option value="">Selecciona habitación disponible</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Hab. {r.room_number}{r.section ? ` — ${r.section}` : ""} · {r.buildings?.name} · ${Number(r.monthly_rate).toLocaleString("es-MX")} MXN
                      </option>
                    ))}
                  </select>
                  {rooms.length === 0 && !loading && (
                    <p className="text-xs text-amber-600">No hay habitaciones disponibles.</p>
                  )}
                </div>

                {/* Tenant */}
                <div className="space-y-1">
                  <Label>Inquilino *</Label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.tenant_id} onChange={f("tenant_id")} required disabled={saving}>
                    <option value="">Selecciona inquilino</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fechas + renta */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Fecha inicio *</Label>
                    <Input type="date" value={form.start_date} onChange={f("start_date")} required disabled={saving} />
                  </div>
                  <div className="space-y-1">
                    <Label>Renta mensual (MXN) *</Label>
                    <Input type="number" min="1" step="0.01" placeholder="8500" value={form.monthly_rate} onChange={f("monthly_rate")} required disabled={saving} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Día de pago (1–28) *</Label>
                    <Input type="number" min="1" max="28" value={form.payment_day} onChange={f("payment_day")} required disabled={saving} />
                  </div>
                  <div className="space-y-1">
                    <Label>Depósito (MXN)</Label>
                    <Input type="number" min="0" step="0.01" placeholder="8500" value={form.deposit_amount} onChange={f("deposit_amount")} disabled={saving} />
                  </div>
                </div>

                {/* Acceso */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Código de acceso</Label>
                    <Input placeholder="ej. 1234" value={form.access_code} onChange={f("access_code")} disabled={saving} />
                  </div>
                  <div className="space-y-1">
                    <Label>Contraseña WiFi</Label>
                    <Input placeholder="wifi123" value={form.wifi_password} onChange={f("wifi_password")} disabled={saving} />
                  </div>
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving || !form.room_id || !form.tenant_id || !form.start_date || !form.monthly_rate}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando…</> : "Crear contrato"}
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
