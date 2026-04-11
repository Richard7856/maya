import type { Incident, IncidentCategory, IncidentPriority, IncidentStatus } from "@maya/types";
import { apiClient } from "./client";

interface CreateIncidentBody {
  room_id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority?: IncidentPriority;
}

interface UpdateIncidentBody {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assigned_to?: string;
  repair_cost?: number;
}

export const incidentsApi = {
  list: (params?: {
    building_id?: string;
    room_id?: string;
    status?: IncidentStatus;
    offset?: number;
    limit?: number;
  }) =>
    apiClient.get<Incident[]>("/incidents", { params }).then((r) => r.data),

  get: (incidentId: string) =>
    apiClient.get<Incident>(`/incidents/${incidentId}`).then((r) => r.data),

  create: (body: CreateIncidentBody) =>
    apiClient.post<Incident>("/incidents", body).then((r) => r.data),

  update: (incidentId: string, body: UpdateIncidentBody) =>
    apiClient.put<Incident>(`/incidents/${incidentId}`, body).then((r) => r.data),

  addUpdate: (incidentId: string, body: { note: string; status_changed_to?: string }) =>
    apiClient.post(`/incidents/${incidentId}/updates`, body).then((r) => r.data),

  addPhoto: (incidentId: string, body: { url: string; type?: string; caption?: string }) =>
    apiClient.post(`/incidents/${incidentId}/photos`, body).then((r) => r.data),
};
