"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Pencil, Receipt, TrendingUp, TrendingDown, Minus, Loader2, Image } from "lucide-react";
import { itemsApi, providersApi, storageApi } from "@maya/api-client";
import type { Item, ItemCreate, ItemPrice, ItemUnit, ProviderCategory, Provider } from "@maya/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES: { value: ProviderCategory; label: string }[] = [
  { value: "plumbing",    label: "Plomería" },
  { value: "electrical",  label: "Eléctrico" },
  { value: "cleaning",    label: "Limpieza" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "security",    label: "Seguridad" },
  { value: "appliances",  label: "Electrodomésticos" },
  { value: "telecom",     label: "Telecom" },
  { value: "other",       label: "Otro" },
];

const UNITS: ItemUnit[] = ["pieza", "m²", "litro", "hora", "servicio", "kg", "rollo", "caja"];

const EMPTY_FORM: ItemCreate = { name: "", category: "maintenance", unit: "pieza" };

// ── Variación % helper ────────────────────────────────────────────────────────
// Calcula la variación entre dos precios consecutivos en el historial
function VariationBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = ((current - previous) / previous) * 100;
  const abs = Math.abs(pct).toFixed(1);

  if (pct > 0.5) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600">
        <TrendingUp className="h-3 w-3" />+{abs}%
      </span>
    );
  }
  if (pct < -0.5) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
        <TrendingDown className="h-3 w-3" />{abs}%↓
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" />sin cambio
    </span>
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ProviderCategory | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemCreate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Price recording
  const [priceItem, setPriceItem] = useState<Item | null>(null);
  const [priceForm, setPriceForm] = useState({ provider_id: "", price: "", notes: "" });
  const [priceAlert, setPriceAlert] = useState<string | null>(null);
  const [priceSaving, setPriceSaving] = useState(false);

  // Receipt photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // Price history expand
  const [expandedPrices, setExpandedPrices] = useState<Record<string, ItemPrice[]>>({});
  const [loadingPrices, setLoadingPrices] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      itemsApi.list({ category: filterCategory || undefined }),
      providersApi.list({ active_only: true }),
    ])
      .then(([i, p]) => { setItems(i); setProviders(p); })
      .finally(() => setLoading(false));
  }, [filterCategory]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, unit: item.unit, description: item.description ?? "", photo_url: item.photo_url ?? "", primary_provider_id: item.primary_provider_id ?? "" });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...form, description: form.description || undefined, primary_provider_id: form.primary_provider_id || undefined };
      editing ? await itemsApi.update(editing.id, payload) : await itemsApi.create(payload);
      setShowForm(false);
      load();
    } catch { setFormError("No se pudo guardar el artículo."); }
    finally { setSaving(false); }
  };

  // Upload receipt photo to Supabase Storage → get public URL
  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptUploading(true);
    setReceiptUrl(null);
    try {
      // Path: receipts/{timestamp}_{filename}
      const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { upload_url, public_url } = await storageApi.presign("receipts", path, file.type);
      await storageApi.uploadToPresignedUrl(upload_url, file, file.type);
      setReceiptUrl(public_url);
    } catch {
      // Si falla el upload, no bloqueamos el registro del precio — solo avisamos
      setReceiptFile(null);
      alert("No se pudo subir la foto. El precio se guardará sin comprobante.");
    } finally {
      setReceiptUploading(false);
    }
  };

  const openPriceModal = (item: Item) => {
    setPriceItem(item);
    setPriceForm({ provider_id: "", price: "", notes: "" });
    setPriceAlert(null);
    setReceiptFile(null);
    setReceiptUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRecordPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceItem || !priceForm.provider_id || !priceForm.price) return;
    if (receiptUploading) return; // esperar a que termine el upload
    setPriceSaving(true);
    setPriceAlert(null);
    try {
      const result = await itemsApi.recordPrice(priceItem.id, {
        provider_id: priceForm.provider_id,
        price: parseFloat(priceForm.price),
        notes: priceForm.notes || undefined,
        receipt_url: receiptUrl || undefined,
      });
      if (result.price_alert && result.alert_detail) {
        setPriceAlert(result.alert_detail.message);
      } else {
        setPriceItem(null);
        // Recargar el historial si estaba expandido
        if (expandedPrices[priceItem.id]) {
          const prices = await itemsApi.getPrices(priceItem.id);
          setExpandedPrices((p) => ({ ...p, [priceItem.id]: prices }));
        }
      }
    } catch { setPriceAlert("Error al registrar el precio."); }
    finally { setPriceSaving(false); }
  };

  const togglePriceHistory = async (item: Item) => {
    if (expandedPrices[item.id]) {
      setExpandedPrices((p) => { const n = { ...p }; delete n[item.id]; return n; });
      return;
    }
    setLoadingPrices(item.id);
    const prices = await itemsApi.getPrices(item.id);
    setExpandedPrices((p) => ({ ...p, [item.id]: prices }));
    setLoadingPrices(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Catálogo de Artículos</h1>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Nuevo artículo</Button>
      </div>

      <div className="flex gap-3">
        <select className="rounded-md border px-3 py-1.5 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as ProviderCategory | "")}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Artículo</th>
                <th className="px-4 py-2 text-left font-medium">Categoría</th>
                <th className="px-4 py-2 text-left font-medium">Unidad</th>
                <th className="px-4 py-2 text-left font-medium">Último precio</th>
                <th className="px-4 py-2 text-left font-medium">Proveedor principal</th>
                <th className="px-4 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            {items.map((item) => {
              const prices = expandedPrices[item.id] ?? [];
              const latest = prices[0] ?? null;
              const prev = prices[1] ?? null;
              return (
                <tbody key={item.id} className="divide-y">
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {CATEGORIES.find((c) => c.value === item.category)?.label}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-3">
                      {latest ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${Number(latest.price).toFixed(2)}</span>
                          <VariationBadge current={Number(latest.price)} previous={prev ? Number(prev.price) : null} />
                          {latest.price_alert && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin registros</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.providers?.name ?? <span className="italic">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openPriceModal(item)}>
                          + Precio
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePriceHistory(item)}>
                          {expandedPrices[item.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Historial expandido */}
                  {expandedPrices[item.id] && (
                    <tr>
                      <td colSpan={6} className="bg-muted/20 px-6 py-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Historial de precios</p>
                        {expandedPrices[item.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Sin precios registrados.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {expandedPrices[item.id].map((pr, idx) => {
                              const nextPr = expandedPrices[item.id][idx + 1];
                              return (
                                <div key={pr.id} className={`flex items-center gap-4 text-xs rounded-md px-2 py-1.5 ${pr.price_alert ? "bg-amber-50 border border-amber-200" : "hover:bg-muted/40"}`}>
                                  {/* Fecha */}
                                  <span className="w-24 shrink-0 text-muted-foreground">
                                    {new Date(pr.recorded_at).toLocaleDateString("es-MX")}
                                  </span>

                                  {/* Precio */}
                                  <span className="w-20 font-semibold">
                                    ${Number(pr.price).toFixed(2)}
                                  </span>

                                  {/* Variación vs precio anterior (el siguiente en el array que está desc) */}
                                  <VariationBadge
                                    current={Number(pr.price)}
                                    previous={nextPr ? Number(nextPr.price) : null}
                                  />

                                  {/* Proveedor */}
                                  <span className="flex-1 text-muted-foreground">{pr.providers?.name ?? "—"}</span>

                                  {/* Quién registró */}
                                  {pr.user_profiles && (
                                    <span className="text-muted-foreground">
                                      {pr.user_profiles.first_name} {pr.user_profiles.last_name}
                                    </span>
                                  )}

                                  {/* Notas */}
                                  {pr.notes && (
                                    <span className="max-w-[180px] truncate text-muted-foreground italic" title={pr.notes}>
                                      {pr.notes}
                                    </span>
                                  )}

                                  {/* Evidencia */}
                                  {pr.receipt_url && (
                                    <a
                                      href={pr.receipt_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1 text-blue-600 hover:underline shrink-0"
                                    >
                                      <Receipt className="h-3 w-3" />
                                      Comprobante
                                    </a>
                                  )}

                                  {/* Alerta */}
                                  {pr.price_alert && (
                                    <span className="flex items-center gap-1 text-amber-600 font-semibold shrink-0">
                                      <AlertTriangle className="h-3 w-3" />Alerta variación
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {loadingPrices === item.id && (
                    <tr><td colSpan={6} className="px-6 py-2 text-xs text-muted-foreground animate-pulse">Cargando precios…</td></tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {/* Item form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing ? "Editar artículo" : "Nuevo artículo"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required disabled={saving} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoría *</Label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProviderCategory }))} disabled={saving}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Unidad</Label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as ItemUnit }))} disabled={saving}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Proveedor principal</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.primary_provider_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, primary_provider_id: e.target.value || undefined }))} disabled={saving}>
                  <option value="">Sin asignar</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Descripción</Label><Input value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} disabled={saving} /></div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Guardando…" : editing ? "Guardar" : "Crear"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price recording modal */}
      {priceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold">Registrar precio</h2>
            <p className="mb-4 text-sm text-muted-foreground">{priceItem.name}</p>
            <form onSubmit={handleRecordPrice} className="space-y-3">
              <div className="space-y-1">
                <Label>Proveedor *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={priceForm.provider_id} onChange={(e) => setPriceForm((f) => ({ ...f, provider_id: e.target.value }))} required disabled={priceSaving}>
                  <option value="">Selecciona proveedor</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Precio (MXN) *</Label>
                <Input type="number" min="0.01" step="0.01" placeholder="0.00" value={priceForm.price} onChange={(e) => setPriceForm((f) => ({ ...f, price: e.target.value }))} required disabled={priceSaving} />
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input placeholder="Compra del 15 abr, factura #…" value={priceForm.notes} onChange={(e) => setPriceForm((f) => ({ ...f, notes: e.target.value }))} disabled={priceSaving} />
              </div>

              {/* Evidencia fotográfica */}
              <div className="space-y-1.5">
                <Label>Foto del ticket / comprobante</Label>
                <div
                  className={`relative flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-3 cursor-pointer transition-colors ${receiptUrl ? "border-emerald-300 bg-emerald-50" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={handleReceiptFileChange}
                    disabled={priceSaving}
                  />
                  {receiptUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Subiendo foto…</span>
                    </>
                  ) : receiptUrl ? (
                    <>
                      <Receipt className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 font-medium truncate">{receiptFile?.name}</span>
                      <a href={receiptUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-blue-600 hover:underline shrink-0" onClick={(e) => e.stopPropagation()}>
                        Ver
                      </a>
                    </>
                  ) : (
                    <>
                      <Image className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Toca para adjuntar foto o PDF</span>
                    </>
                  )}
                </div>
              </div>

              {priceAlert && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{priceAlert}</p>
                    <p className="text-xs mt-1">El precio fue guardado. Verifica si es correcto.</p>
                    <Button type="button" size="sm" className="mt-2 h-7 text-xs" onClick={() => {
                      setPriceItem(null);
                      setPriceAlert(null);
                      // Refrescar historial si estaba abierto
                      if (priceItem && expandedPrices[priceItem.id]) {
                        itemsApi.getPrices(priceItem.id).then((prices) =>
                          setExpandedPrices((p) => ({ ...p, [priceItem.id]: prices }))
                        );
                      }
                    }}>
                      Entendido
                    </Button>
                  </div>
                </div>
              )}

              {!priceAlert && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setPriceItem(null); setPriceAlert(null); }} disabled={priceSaving || receiptUploading}>Cancelar</Button>
                  <Button type="submit" disabled={priceSaving || receiptUploading || !priceForm.provider_id || !priceForm.price}>
                    {priceSaving ? "Guardando…" : receiptUploading ? "Subiendo foto…" : "Registrar precio"}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
