// Shared axios instance used by all apps.
// The base URL and auth token are injected at runtime via environment variables
// and the Supabase session respectively.
import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach Supabase JWT to every request.
// Each app calls setAuthToken() after Supabase auth state changes.
export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}
