"use client";

import { useState } from "react";
import { buildingsApi } from "@maya/api-client";
import type { Room } from "@maya/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  buildingId: string;
  onCreated: (room: Room) => void;
}

export function NewRoomDialog({ buildingId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ room_number: "", section: "", monthly_rate: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.room_number.trim() || !form.monthly_rate) return;
    setSaving(true);
    setError(null);
    try {
      const created = await buildingsApi.createRoom(buildingId, {
        room_number: form.room_number.trim(),
        section: form.section.trim() || undefined,
        monthly_rate: parseFloat(form.monthly_rate),
        status: "vacant",
      });
      onCreated(created);
      setForm({ room_number: "", section: "", monthly_rate: "" });
      setOpen(false);
    } catch {
      setError("No se pudo crear la habitación.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        + Nueva habitación
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">Nueva habitación</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Número / ID *</Label>
            <Input
              placeholder="101, A1, Studio-3..."
              value={form.room_number}
              onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Sección / Piso</Label>
            <Input
              placeholder="Piso 2, Planta Baja..."
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label>Renta mensual (MXN) *</Label>
            <Input
              type="number"
              min="0"
              step="100"
              placeholder="5500"
              value={form.monthly_rate}
              onChange={(e) => setForm((f) => ({ ...f, monthly_rate: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.room_number.trim() || !form.monthly_rate}>
              {saving ? "Creando…" : "Crear habitación"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
