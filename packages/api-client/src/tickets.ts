import type { Ticket, TicketType, TicketStatus, IncidentPriority } from "@maya/types";
import { apiClient } from "./client";

export interface CreateTicketBody {
  room_id: string;
  type: TicketType;
  title: string;
  description: string;
  priority?: IncidentPriority;
  assigned_to?: string;
  due_date?: string;
  // URL de foto de evidencia — solo para tickets de tipo maintenance creados por cleaning staff
  evidence_url?: string;
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

// ─── Ticket Items (Phase 2) ──────────────────────────────────────────────────

export interface TicketItem {
  id: string;
  ticket_id: string;
  item_id: string;
  qty: number;
  estimated_price: number | null;
  added_by: string | null;
  added_at: string;
  notes: string | null;
  // JOIN from items table
  items?: {
    id: string;
    name: string;
    unit: string;
    category: string;
  } | null;
}

interface AddTicketItemBody {
  item_id: string;
  qty?: number;
  notes?: string;
}

export interface RequisitionGroup {
  provider: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    zone: string | null;
  };
  items: Array<{
    ticket_item_id: string;
    item_id: string;
    name: string;
    unit: string;
    qty: number;
    unit_price: number;
    subtotal: number;
    notes: string | null;
  }>;
  group_total: number;
}

export interface Requisition {
  ticket_id: string;
  ticket_title: string;
  groups: RequisitionGroup[];
  sin_precio: Array<{
    ticket_item_id: string;
    item_id: string;
    name: string;
    unit: string;
    qty: number;
    notes: string | null;
  }>;
  grand_total: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

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

  // Phase 2: cart operations
  listItems: (ticketId: string) =>
    apiClient.get<TicketItem[]>(`/tickets/${ticketId}/items`).then((r) => r.data),

  addItem: (ticketId: string, body: AddTicketItemBody) =>
    apiClient.post<TicketItem>(`/tickets/${ticketId}/items`, body).then((r) => r.data),

  removeItem: (ticketId: string, ticketItemId: string) =>
    apiClient.delete(`/tickets/${ticketId}/items/${ticketItemId}`),

  getRequisition: (ticketId: string) =>
    apiClient.get<Requisition>(`/tickets/${ticketId}/requisition`).then((r) => r.data),
};
