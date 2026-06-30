import { apiFetch } from "@/lib/api/client";
import type { SessionUser } from "@/lib/auth/session-types";
import type {
  AdminDashboardBundle,
  AdminDailyReportBundle,
  AppSettings,
  Carrier,
  CreateDispatcherResult,
  DailyActivity,
  DashboardMetric,
  DispatcherDashboardBundle,
  DispatcherFinanceBundle,
  Dispatcher,
  DispatchFeeRules,
  InvoiceDetail,
  InvoiceListBundle,
  InvoicePreview,
  CreateManagedUserResult,
  ManagedUser,
  PendingUserRequest,
  RankingRow,
  ReportBundle,
  ResetManagedUserPasswordResult,
  SearchResults,
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

export function fetchDispatchers(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<Dispatcher[]>(`/api/dispatchers${query}`);
}

export function createDispatcherRequest(input: Record<string, unknown>) {
  return apiFetch<CreateDispatcherResult>("/api/dispatchers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDispatcherRequest(
  id: string,
  input: Record<string, unknown>,
) {
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

export function fetchCarriers(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<Carrier[]>(`/api/carriers${query}`);
}

export function createCarrierRequest(input: Record<string, unknown>) {
  return apiFetch<Carrier>("/api/carriers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCarrierRequest(
  id: string,
  input: Record<string, unknown>,
) {
  return apiFetch<Carrier>(`/api/carriers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function reassignCarrierRequest(
  id: string,
  input: Record<string, unknown>,
) {
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

export function updateActivityRequest(
  id: string,
  input: Record<string, unknown>,
) {
  return apiFetch<DailyActivity>(`/api/activities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchPendingActivities() {
  return apiFetch<DailyActivity[]>("/api/activities/pending");
}

export function approveActivityRequest(
  id: string,
  input?: { approvalNotes?: string },
) {
  return apiFetch<DailyActivity>(`/api/activities/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export function rejectActivityRequest(
  id: string,
  input: {
    reason: string;
    requestChanges?: boolean;
    approvalNotes?: string;
  },
) {
  return apiFetch<DailyActivity>(`/api/activities/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchPendingApprovals() {
  return apiFetch<import("@/lib/types").PendingApprovalItem[]>(
    "/api/activities/pending",
  );
}

export function fetchDispatcherSubmissions() {
  return apiFetch<import("@/lib/types").PendingApprovalItem[]>(
    "/api/activities/submissions",
  );
}

export function approveEditRequestRequest(
  id: string,
  input?: { approvalNotes?: string },
) {
  return apiFetch<import("@/lib/types").ActivityEditRequestDto>(
    `/api/activity-edit-requests/${id}/approve`,
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
  );
}

export function rejectEditRequestRequest(
  id: string,
  input: {
    reason: string;
    requestChanges?: boolean;
    approvalNotes?: string;
  },
) {
  return apiFetch<import("@/lib/types").ActivityEditRequestDto>(
    `/api/activity-edit-requests/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchNotifications() {
  return apiFetch<{
    notifications: import("@/lib/types").AppNotification[];
    unreadCount: number;
  }>("/api/notifications");
}

export function markNotificationReadRequest(id: string) {
  return apiFetch<{ success: true }>(`/api/notifications/${id}/read`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function markAllNotificationsReadRequest() {
  return apiFetch<{ success: true }>("/api/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchAdminLogs(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<import("@/lib/types").AuditLogEntry[]>(
    `/api/admin/logs${query}`,
  );
}

export function recordAuditExportEvent(input: Record<string, unknown>) {
  return apiFetch<{ success: true }>("/api/audit/export-events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAdminDashboard(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<AdminDashboardBundle>(`/api/dashboard/admin${query}`);
}

export function fetchAdminDailyReport(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<AdminDailyReportBundle>(`/api/admin/daily-report${query}`);
}

export function fetchTeamLeadDashboard() {
  return apiFetch<DashboardMetric>("/api/dashboard/team-lead");
}

export function fetchDispatcherDashboard(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<DispatcherDashboardBundle>(
    `/api/dashboard/dispatcher${query}`,
  );
}

export function fetchRankings(
  type: "dispatcher" | "carrier" | "team",
  params?: Record<string, string>,
) {
  const search = new URLSearchParams({ type, ...(params ?? {}) });
  return apiFetch<RankingRow[]>(`/api/rankings?${search.toString()}`);
}

export function fetchReports(params: Record<string, string>) {
  return apiFetch<ReportBundle>(
    `/api/reports?${new URLSearchParams(params).toString()}`,
  );
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

export function fetchAllowedStatusReasons() {
  return apiFetch<string[]>("/api/settings/status-reasons");
}

export function fetchDispatchFeeRules() {
  return apiFetch<DispatchFeeRules>("/api/settings/dispatch-fee-rules");
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

export function fetchManagedUsers() {
  return apiFetch<ManagedUser[]>("/api/users");
}

export function createManagedUserRequest(input: Record<string, unknown>) {
  return apiFetch<CreateManagedUserResult>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resetManagedUserPasswordRequest(
  id: string,
  input: Record<string, unknown>,
) {
  return apiFetch<ResetManagedUserPasswordResult>(`/api/users/${id}/password`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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

export function forgotPasswordRequest(email: string) {
  return apiFetch<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function updatePasswordRequest(password: string) {
  return apiFetch<{ message: string }>("/api/auth/update-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function searchOrganizationRequest(query: string) {
  return apiFetch<SearchResults>(
    `/api/search?${new URLSearchParams({ q: query }).toString()}`,
  );
}

export function fetchDispatcherFinance(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<DispatcherFinanceBundle>(`/api/dispatcher/finance${query}`);
}

export function fetchAdminDispatcherFinance(
  dispatcherId: string,
  params?: Record<string, string>,
) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<DispatcherFinanceBundle>(
    `/api/admin/dispatchers/${dispatcherId}/finance${query}`,
  );
}

export function exportDispatcherFinanceRequest(input: Record<string, unknown>) {
  return apiFetch<{ csv: string; fileName: string }>(
    "/api/dispatcher/finance/export",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function exportAdminDispatcherFinanceRequest(
  dispatcherId: string,
  input: Record<string, unknown>,
) {
  return apiFetch<{ csv: string; fileName: string }>(
    `/api/admin/dispatchers/${dispatcherId}/finance/export`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchInvoices(
  scope: "admin" | "dispatcher" | "team-lead",
  params?: Record<string, string>,
) {
  const base =
    scope === "admin"
      ? "/api/invoices"
      : scope === "dispatcher"
        ? "/api/dispatcher/invoices"
        : "/api/team-lead/invoices";
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<InvoiceListBundle>(`${base}${query}`);
}

export function fetchInvoiceDetail(
  scope: "admin" | "dispatcher" | "team-lead",
  id: string,
) {
  const base =
    scope === "admin"
      ? "/api/invoices"
      : scope === "dispatcher"
        ? "/api/dispatcher/invoices"
        : "/api/team-lead/invoices";
  return apiFetch<InvoiceDetail>(`${base}/${id}`);
}

export function generateInvoiceRequest(input: Record<string, unknown>) {
  return apiFetch<InvoiceDetail | InvoicePreview>("/api/invoices/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateInvoiceRequest(id: string, input: Record<string, unknown>) {
  return apiFetch<InvoiceDetail>(`/api/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function recordInvoicePaymentRequest(
  id: string,
  input: Record<string, unknown>,
) {
  return apiFetch<InvoiceDetail>(`/api/invoices/${id}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function markInvoicePaidRequest(id: string) {
  return apiFetch<InvoiceDetail>(`/api/invoices/${id}/mark-paid`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function cancelInvoiceRequest(id: string, notes?: string) {
  return apiFetch<InvoiceDetail>(`/api/invoices/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function exportInvoiceRequest(
  scope: "admin" | "dispatcher" | "team-lead",
  id: string,
  input: { format: "pdf" | "csv" | "payments-csv" },
) {
  const base =
    scope === "admin"
      ? "/api/invoices"
      : scope === "dispatcher"
        ? "/api/dispatcher/invoices"
        : "/api/team-lead/invoices";
  return apiFetch<{ fileName: string; csv?: string; invoice?: InvoiceDetail }>(
    `${base}/${id}/export`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function exportInvoiceListRequest(input: Record<string, unknown>) {
  return apiFetch<{ fileName: string; csv: string }>("/api/invoices/export", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
