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

export const buildingsApi = {
  list: () =>
    apiClient.get<Building[]>("/buildings").then((r) => r.data),

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
};
