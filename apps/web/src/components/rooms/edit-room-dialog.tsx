"use client";

import { useState } from "react";
import { buildingsApi } from "@maya/api-client";
import type { Room, RoomStatus } from "@maya/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

const STATUSES: { value: RoomStatus; label: string }[] = [
  { value: "vacant", label: "Disponible" },
  { value: "occupied", label: "Ocupada" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "incoming", label: "Por ingresar" },
];

interface Props {
  buildingId: string;
  room: Room;
  onUpdated: (room: Room) => void;
}

export function EditRoomDialog({ buildingId, room, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    room_number: room.room_number,
    section: room.section ?? "",
    monthly_rate: String(room.monthly_rate),
    status: room.status as RoomStatus,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await buildingsApi.updateRoom(buildingId, room.id, {
        room_number: form.room_number,
        section: form.section || undefined,
        monthly_rate: parseFloat(form.monthly_rate),
        status: form.status,
      });
      onUpdated(updated);
      setOpen(false);
    } catch {
      setError("No se pudo actualizar la habitación.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        title="Editar habitación"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">
          Editar habitación {room.room_number}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Número / ID</Label>
            <Input
              value={form.room_number}
              onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Sección / Piso</Label>
            <Input
              placeholder="Ej: Piso 2, Planta Baja"
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label>Renta mensual (MXN)</Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={form.monthly_rate}
              onChange={(e) => setForm((f) => ({ ...f, monthly_rate: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: s.value }))}
                  disabled={saving}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    form.status === s.value
                      ? "border-black bg-black text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
