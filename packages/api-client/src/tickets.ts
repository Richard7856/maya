import type { Ticket, TicketType, TicketStatus, IncidentPriority } from "@maya/types";
import { apiClient } from "./client";

interface CreateTicketBody {
  room_id: string;
  type: TicketType;
  title: string;
  description: string;
  priority?: IncidentPriority;
  assigned_to?: string;
  due_date?: string;
}

interface UpdateTicketBody {
  title?: string;
  description?: string;
  type?: TicketType;
  priority?: IncidentPriority;
  assigned_to?: string;
  due_date?: string;
  status?: TicketStatus;
}

export const ticketsApi = {
  list: (params?: {
    type?: TicketType;
    status?: TicketStatus;
    priority?: IncidentPriority;
    building_id?: string;
    offset?: number;
    limit?: number;
  }) =>
    apiClient.get<Ticket[]>("/tickets", { params }).then((r) => r.data),

  get: (ticketId: string) =>
    apiClient.get<Ticket>(`/tickets/${ticketId}`).then((r) => r.data),

  create: (body: CreateTicketBody) =>
    apiClient.post<Ticket>("/tickets", body).then((r) => r.data),

  update: (ticketId: string, body: UpdateTicketBody) =>
    apiClient.put<Ticket>(`/tickets/${ticketId}`, body).then((r) => r.data),

  updateStatus: (ticketId: string, status: TicketStatus) =>
    apiClient.patch<Ticket>(`/tickets/${ticketId}/status`, { status }).then((r) => r.data),
};
