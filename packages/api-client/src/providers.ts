import { apiClient } from "./client";

export type ProviderCategory =
  | "plumbing" | "electrical" | "cleaning" | "maintenance"
  | "security" | "appliances" | "telecom" | "other";

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  phone: string | null;
  whatsapp: string | null;
  zone: string | null;
  building_id: string | null;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  buildings?: { name: string } | null;
}

export interface ProviderCreate {
  name: string;
  category: ProviderCategory;
  phone?: string;
  whatsapp?: string;
  zone?: string;
  building_id?: string;
  photo_url?: string;
  notes?: string;
}

export interface ProviderUpdate extends Partial<ProviderCreate> {
  is_active?: boolean;
}

export const providersApi = {
  list: (params?: { category?: ProviderCategory; zone?: string; building_id?: string; active_only?: boolean }) =>
    apiClient.get<Provider[]>("/providers", { params }).then((r) => r.data),

  create: (body: ProviderCreate) =>
    apiClient.post<Provider>("/providers", body).then((r) => r.data),

  update: (id: string, body: ProviderUpdate) =>
    apiClient.patch<Provider>(`/providers/${id}`, body).then((r) => r.data),
};
