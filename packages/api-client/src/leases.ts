import type { Lease, LeaseStatus } from "@maya/types";
import { apiClient } from "./client";

interface CreateLeaseBody {
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date?: string;
  monthly_rate: number;
  payment_day: number;
  deposit_amount?: number;
  contract_url?: string;
  wifi_password?: string;
  access_code?: string;
}

interface UpdateLeaseBody {
  status?: LeaseStatus;
  monthly_rate?: number;
  end_date?: string;
  payment_day?: number;
  contract_url?: string;
  wifi_password?: string;
  access_code?: string;
}

export const leasesApi = {
  list: (params?: {
    building_id?: string;
    status?: LeaseStatus;
    offset?: number;
    limit?: number;
  }) =>
    apiClient.get<Lease[]>("/leases", { params }).then((r) => r.data),

  mine: () =>
    apiClient.get<Lease>("/leases/mine").then((r) => r.data),

  get: (leaseId: string) =>
    apiClient.get<Lease>(`/leases/${leaseId}`).then((r) => r.data),

  create: (body: CreateLeaseBody) =>
    apiClient.post<Lease>("/leases", body).then((r) => r.data),

  update: (leaseId: string, body: UpdateLeaseBody) =>
    apiClient.put<Lease>(`/leases/${leaseId}`, body).then((r) => r.data),
};
