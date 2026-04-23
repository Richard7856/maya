"use client";

import { useState } from "react";
import { buildingsApi } from "@maya/api-client";
import type { Building } from "@maya/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCreated: (building: Building) => void;
}

export function NewBuildingDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "Ciudad de México" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await buildingsApi.create(form);
      onCreated(created);
      setForm({ name: "", address: "", city: "Ciudad de México" });
      setOpen(false);
    } catch {
      setError("No se pudo crear el edificio. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Nuevo edificio
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Nuevo edificio</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              placeholder="Edificio Álamos"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Dirección *</Label>
            <Input
              id="address"
              placeholder="Calle Álamos 45, Col. Narvarte"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              placeholder="Ciudad de México"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              disabled={saving}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim() || !form.address.trim()}>
              {saving ? "Guardando…" : "Crear edificio"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
