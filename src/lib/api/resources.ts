import { apiFetch } from "@/lib/api/client";
import type { SessionUser } from "@/lib/auth/session-types";
import type {
  AppSettings,
  Carrier,
  DailyActivity,
  DashboardMetric,
  Dispatcher,
  PendingUserRequest,
  RankingRow,
  ReportBundle,
  Team,
} from "@/lib/types";
import type { Role } from "@/lib/constants/roles";

export type { SessionUser };

export function fetchPublicTeams() {
  return apiFetch<{ id: string; name: string }[]>("/api/public/teams");
}

export function fetchSession() {
  return apiFetch<SessionUser | null>("/api/auth/me");
}

export function loginRequest(input: {
  email: string;
  password: string;
  expectedRole: Role;
}) {
  return apiFetch<SessionUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutRequest() {
  return apiFetch<{ success: true }>("/api/auth/logout", { method: "POST" });
}

export function registerDispatcherRequest(input: {
  fullName: string;
  email: string;
  phoneNumber: string;
  preferredTeamId?: string;
  preferredTeamName?: string;
  notes?: string;
}) {
  return apiFetch<{ id: string; message: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchTeams() {
  return apiFetch<Team[]>("/api/teams");
}

export function createTeamRequest(input: Record<string, unknown>) {
  return apiFetch<Team>("/api/teams", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTeamRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<Team>(`/api/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchDispatchers() {
  return apiFetch<Dispatcher[]>("/api/dispatchers");
}

export function createDispatcherRequest(input: Record<string, unknown>) {
  return apiFetch<Dispatcher>("/api/dispatchers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDispatcherRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<Dispatcher>(`/api/dispatchers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function toggleDispatcherStatusRequest(
  id: string,
  action: "activate" | "deactivate",
) {
  return apiFetch<Dispatcher>(`/api/dispatchers/${id}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function fetchCarriers() {
  return apiFetch<Carrier[]>("/api/carriers");
}

export function createCarrierRequest(input: Record<string, unknown>) {
  return apiFetch<Carrier>("/api/carriers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCarrierRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<Carrier>(`/api/carriers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function reassignCarrierRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<Carrier>(`/api/carriers/${id}/reassign`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchActivities(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<DailyActivity[]>(`/api/activities${query}`);
}

export function createActivityRequest(input: Record<string, unknown>) {
  return apiFetch<DailyActivity>("/api/activities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateActivityRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<DailyActivity>(`/api/activities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchAdminDashboard() {
  return apiFetch<DashboardMetric>("/api/dashboard/admin");
}

export function fetchTeamLeadDashboard() {
  return apiFetch<DashboardMetric>("/api/dashboard/team-lead");
}

export function fetchDispatcherDashboard() {
  return apiFetch<DashboardMetric>("/api/dashboard/dispatcher");
}

export function fetchRankings(type: "dispatcher" | "carrier" | "team") {
  return apiFetch<RankingRow[]>(`/api/rankings?type=${type}`);
}

export function fetchReports(params: Record<string, string>) {
  return apiFetch<ReportBundle>(`/api/reports?${new URLSearchParams(params).toString()}`);
}

export function exportReportRequest(input: Record<string, unknown>) {
  return apiFetch<{ csv: string; fileName: string; rowCount: number }>(
    "/api/reports/export",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchSettings() {
  return apiFetch<AppSettings>("/api/settings");
}

export function updateSettingsRequest(input: Record<string, unknown>) {
  return apiFetch<AppSettings>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchUserRequests() {
  return apiFetch<PendingUserRequest[]>("/api/users/requests");
}

export function approveUserRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<{ id: string }>(`/api/users/requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function rejectUserRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<{ id: string }>(`/api/users/requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
