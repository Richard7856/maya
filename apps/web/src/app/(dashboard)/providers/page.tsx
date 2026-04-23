"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, MessageCircle, MapPin, Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { providersApi } from "@maya/api-client";
import type { Provider, ProviderCategory, ProviderCreate } from "@maya/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const CATEGORIES: { value: ProviderCategory; label: string }[] = [
  { value: "plumbing",    label: "Plomería" },
  { value: "electrical",  label: "Eléctrico" },
  { value: "cleaning",    label: "Limpieza" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "security",    label: "Seguridad" },
  { value: "appliances",  label: "Electrodomésticos" },
  { value: "telecom",     label: "Telecom / Internet" },
  { value: "other",       label: "Otro" },
];

const CATEGORY_COLORS: Record<ProviderCategory, string> = {
  plumbing:    "bg-blue-100 text-blue-700",
  electrical:  "bg-yellow-100 text-yellow-700",
  cleaning:    "bg-green-100 text-green-700",
  maintenance: "bg-orange-100 text-orange-700",
  security:    "bg-red-100 text-red-700",
  appliances:  "bg-purple-100 text-purple-700",
  telecom:     "bg-cyan-100 text-cyan-700",
  other:       "bg-gray-100 text-gray-700",
};

const EMPTY_FORM: ProviderCreate = {
  name: "", category: "maintenance", phone: "", whatsapp: "", zone: "", notes: "",
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ProviderCategory | "">("");
  const [filterZone, setFilterZone] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderCreate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    providersApi
      .list({
        category: filterCategory || undefined,
        zone: filterZone || undefined,
        active_only: !showInactive,
      })
      .then(setProviders)
      .finally(() => setLoading(false));
  }, [filterCategory, filterZone, showInactive]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm({
      name: p.name, category: p.category,
      phone: p.phone ?? "", whatsapp: p.whatsapp ?? "",
      zone: p.zone ?? "", notes: p.notes ?? "",
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleToggleActive = async (p: Provider) => {
    await providersApi.update(p.id, { is_active: !p.is_active });
    load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...form, phone: form.phone || undefined, whatsapp: form.whatsapp || undefined, zone: form.zone || undefined, notes: form.notes || undefined };
      if (editing) {
        await providersApi.update(editing.id, payload);
      } else {
        await providersApi.create(payload);
      }
      setShowForm(false);
      load();
    } catch {
      setFormError("No se pudo guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo proveedor
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border px-3 py-1.5 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ProviderCategory | "")}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Input
          placeholder="Filtrar por zona (Roma, Interlomas…)"
          className="h-9 w-52 text-sm"
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay proveedores con ese filtro.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border bg-card p-4 space-y-2 ${!p.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  {p.zone && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />{p.zone}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[p.category]}`}>
                  {CATEGORIES.find((c) => c.value === p.category)?.label}
                </span>
              </div>

              {p.notes && <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>}

              <div className="flex items-center gap-2 pt-1">
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Phone className="h-3 w-3" />{p.phone}
                  </a>
                )}
                {p.whatsapp && (
                  <a
                    href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" />WA
                  </a>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(p)} title={p.is_active ? "Desactivar" : "Activar"}>
                    {p.is_active
                      ? <ToggleRight className="h-4 w-4 text-green-600" />
                      : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? "Editar proveedor" : "Nuevo proveedor"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required disabled={saving} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoría *</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProviderCategory }))}
                    disabled={saving}
                  >
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Zona</Label>
                  <Input placeholder="Roma, Interlomas…" value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} disabled={saving} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input placeholder="+5255…" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} disabled={saving} />
                </div>
                <div className="space-y-1">
                  <Label>WhatsApp</Label>
                  <Input placeholder="+5255…" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} disabled={saving} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input placeholder="Horario, especialidad…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} disabled={saving} />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear proveedor"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
