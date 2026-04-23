import type { Building, Room, RoomStatus } from "@maya/types";
import { apiClient } from "./client";

export interface BuildingKpis {
  total_rooms: number;
  occupied_rooms: number;
  occupancy_rate: number; // 0–1
  monthly_revenue: number;
  overdue_payments: number;
  open_incidents: number;
  open_tickets: number;
}

export interface BuildingCreate {
  name: string;
  address: string;
  city: string;
}

export interface RoomCreate {
  room_number: string;
  section?: string;
  monthly_rate: number;
  status?: RoomStatus;
}

export interface RoomUpdate {
  room_number?: string;
  section?: string;
  monthly_rate?: number;
  status?: RoomStatus;
}

// Room con building name incluido via JOIN (para selects de formularios)
export interface RoomWithBuilding extends Room {
  buildings?: { id: string; name: string } | null;
}

export const buildingsApi = {
  list: () =>
    apiClient.get<Building[]>("/buildings").then((r) => r.data),

  // Todas las habitaciones a través de edificios, con filtro opcional de status.
  // Usa el endpoint GET /buildings/rooms (admin only) para poblar selects de formularios.
  listRooms: (params?: { status?: RoomStatus; building_id?: string }) =>
    apiClient
      .get<RoomWithBuilding[]>("/buildings/rooms", { params })
      .then((r) => r.data),

  create: (body: BuildingCreate) =>
    apiClient.post<Building>("/buildings", body).then((r) => r.data),

  getKpis: (buildingId: string) =>
    apiClient
      .get<BuildingKpis>(`/buildings/${buildingId}/kpis`)
      .then((r) => r.data),

  getRooms: (buildingId: string, status?: RoomStatus) =>
    apiClient
      .get<Room[]>(`/buildings/${buildingId}/rooms`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),

  createRoom: (buildingId: string, body: RoomCreate) =>
    apiClient
      .post<Room>(`/buildings/${buildingId}/rooms`, body)
      .then((r) => r.data),

  updateRoom: (buildingId: string, roomId: string, body: RoomUpdate) =>
    apiClient
      .patch<Room>(`/buildings/${buildingId}/rooms/${roomId}`, body)
      .then((r) => r.data),
};
