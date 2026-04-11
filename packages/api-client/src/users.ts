import type { UserProfile, UserRole } from "@maya/types";
import { apiClient } from "./client";

export const usersApi = {
  me: () =>
    apiClient.get<UserProfile>("/users/me").then((r) => r.data),

  list: (params?: { role?: UserRole; offset?: number; limit?: number }) =>
    apiClient.get<UserProfile[]>("/users", { params }).then((r) => r.data),

  get: (userId: string) =>
    apiClient.get<UserProfile>(`/users/${userId}`).then((r) => r.data),

  updateMe: (body: { phone?: string; expo_push_token?: string }) =>
    apiClient.put<UserProfile>("/users/me", body).then((r) => r.data),

  lock: (userId: string) =>
    apiClient.patch<UserProfile>(`/users/${userId}/lock`).then((r) => r.data),

  unlock: (userId: string) =>
    apiClient.patch<UserProfile>(`/users/${userId}/unlock`).then((r) => r.data),
};
