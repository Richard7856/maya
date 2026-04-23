import { apiClient } from "./client";

export interface Complaint {
  id: string;
  room_id: string;
  tenant_id: string | null;   // null cuando is_anonymous=TRUE (vista complaints_safe)
  title: string;
  description: string | null;
  category: string;
  status: ComplaintStatus;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  rooms?: {
    room_number: string;
    building_id: string;
    buildings?: { name: string } | null;
  } | null;
}

export type ComplaintStatus = "open" | "investigating" | "resolved" | "closed";

export const complaintsApi = {
  list: (params?: {
    status?: ComplaintStatus;
    building_id?: string;
    offset?: number;
    limit?: number;
  }) =>
    apiClient.get<Complaint[]>("/complaints", { params }).then((r) => r.data),

  updateStatus: (complaintId: string, status: ComplaintStatus) =>
    apiClient
      .patch<Complaint>(`/complaints/${complaintId}/status`, { status })
      .then((r) => r.data),
};
