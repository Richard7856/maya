import { apiClient } from "./client";
import type { ProviderCategory } from "./providers";

export type ItemUnit = "pieza" | "m²" | "litro" | "hora" | "servicio" | "kg" | "rollo" | "caja";

export interface Item {
  id: string;
  name: string;
  category: ProviderCategory;
  unit: ItemUnit;
  description: string | null;
  photo_url: string | null;
  primary_provider_id: string | null;
  is_active: boolean;
  created_at: string;
  providers?: { id: string; name: string; category: string } | null;
}

export interface ItemPrice {
  id: string;
  item_id: string;
  provider_id: string;
  price: number;
  recorded_by: string | null;
  recorded_at: string;
  notes: string | null;
  receipt_url: string | null;   // foto del ticket de caja
  price_alert: boolean;
  alert_detail?: {
    previous_price: number;
    variation_pct: number;
    message: string;
  };
  providers?: { name: string };
  user_profiles?: { first_name: string; last_name: string };
}

export interface ItemCreate {
  name: string;
  category: ProviderCategory;
  unit?: ItemUnit;
  description?: string;
  photo_url?: string;
  primary_provider_id?: string;
}

export interface ItemUpdate extends Partial<ItemCreate> {
  is_active?: boolean;
}

export const itemsApi = {
  list: (params?: { category?: ProviderCategory; active_only?: boolean }) =>
    apiClient.get<Item[]>("/items", { params }).then((r) => r.data),

  create: (body: ItemCreate) =>
    apiClient.post<Item>("/items", body).then((r) => r.data),

  update: (id: string, body: ItemUpdate) =>
    apiClient.patch<Item>(`/items/${id}`, body).then((r) => r.data),

  getPrices: (itemId: string, providerId?: string) =>
    apiClient
      .get<ItemPrice[]>(`/items/${itemId}/prices`, {
        params: providerId ? { provider_id: providerId } : undefined,
      })
      .then((r) => r.data),

  recordPrice: (itemId: string, body: { provider_id: string; price: number; notes?: string; receipt_url?: string }) =>
    apiClient.post<ItemPrice>(`/items/${itemId}/prices`, body).then((r) => r.data),
};
