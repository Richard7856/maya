import type { CleaningAssignment, CleaningAssignmentStatus, CleaningSession, TimeBlock } from "@maya/types";
import { apiClient } from "./client";

interface CreateAssignmentBody {
  cleaner_id: string;
  room_id: string;
  scheduled_date: string;
  time_block: TimeBlock;
}

interface ChecklistItem {
  label: string;
  is_done: boolean;
  photo_url?: string;
  notes?: string;
}

export const cleaningApi = {
  listAssignments: (params?: {
    building_id?: string;
    cleaner_id?: string;
    status?: CleaningAssignmentStatus;
    date_from?: string;
    date_to?: string;
    offset?: number;
    limit?: number;
  }) =>
    apiClient
      .get<CleaningAssignment[]>("/cleaning/assignments", { params })
      .then((r) => r.data),

  getAssignment: (assignmentId: string) =>
    apiClient
      .get<CleaningAssignment>(`/cleaning/assignments/${assignmentId}`)
      .then((r) => r.data),

  createAssignment: (body: CreateAssignmentBody) =>
    apiClient
      .post<CleaningAssignment>("/cleaning/assignments", body)
      .then((r) => r.data),

  updateAssignmentStatus: (assignmentId: string, status: CleaningAssignmentStatus) =>
    apiClient
      .patch<CleaningAssignment>(`/cleaning/assignments/${assignmentId}/status`, { status })
      .then((r) => r.data),

  startSession: (assignmentId: string, body: { arrival_lat: number; arrival_lng: number }) =>
    apiClient
      .post<CleaningSession>(`/cleaning/sessions/${assignmentId}/start`, body)
      .then((r) => r.data),

  completeSession: (assignmentId: string, checklist_items: ChecklistItem[]) =>
    apiClient
      .post(`/cleaning/sessions/${assignmentId}/complete`, { checklist_items })
      .then((r) => r.data),
};
