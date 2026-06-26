"use client";

import { useCallback, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { AppToast } from "@/components/feedback/app-toast";
import { FilterField } from "@/components/filters/filter-field";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import {
  AUDIT_MODULE_ENTITY_TYPES,
  AUDIT_STATUSES,
  deriveAuditModule,
  formatAuditAction,
} from "@/lib/audit/audit-log-format";
import { fetchAdminLogs } from "@/lib/api/resources";
import type { AuditLogEntry } from "@/lib/types";
import { escapeCsvCell } from "@/lib/utils/csv";
import { formatDate } from "@/lib/utils/format-date";

const FILTER_ALL = "all";

const ACTIONS: AuditLogEntry["action"][] = [
  "USER_LOGGED_IN",
  "USER_APPROVED",
  "USER_REJECTED",
  "USER_ROLE_ASSIGNED",
  "USER_TEAM_ASSIGNED",
  "TEAM_CREATED",
  "TEAM_UPDATED",
  "TEAM_DEACTIVATED",
  "DISPATCHER_CREATED",
  "DISPATCHER_UPDATED",
  "DISPATCHER_DEACTIVATED",
  "CARRIER_CREATED",
  "CARRIER_UPDATED",
  "CARRIER_DEACTIVATED",
  "CARRIER_REASSIGNED",
  "ACTIVITY_CREATED",
  "ACTIVITY_UPDATED",
  "ACTIVITY_SUBMITTED",
  "ACTIVITY_APPROVED_BY_TEAM_LEAD",
  "ACTIVITY_APPROVED_BY_ADMIN",
  "ACTIVITY_REJECTED",
  "ACTIVITY_PENDING_UPDATED",
  "SETTINGS_UPDATED",
  "REPORT_EXPORTED",
];

const ROLE_OPTIONS = ["ADMIN", "TEAM_LEAD", "DISPATCHER"] as const;

type Filters = {
  status: string;
  action: string;
  module: string;
  role: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: Filters = {
  status: FILTER_ALL,
  action: FILTER_ALL,
  module: FILTER_ALL,
  role: FILTER_ALL,
  dateFrom: "",
  dateTo: "",
};

function buildParams(filters: Filters, limit: number): Record<string, string> {
  const params: Record<string, string> = { limit: String(limit) };

  if (filters.status !== FILTER_ALL) params.status = filters.status;
  if (filters.action !== FILTER_ALL) params.action = filters.action;
  if (filters.module !== FILTER_ALL) params.entityType = filters.module;
  if (filters.role !== FILTER_ALL) params.role = filters.role;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;

  return params;
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Approved" || status === "Created") return "default";
  if (status === "Rejected" || status === "Deleted") return "destructive";
  if (status === "Logged In") return "secondary";
  return "outline";
}

function formatJson(value: Record<string, unknown> | null) {
  if (!value) return "—";
  return JSON.stringify(value);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return escapeCsvCell(text);
}

function entriesToCsv(entries: AuditLogEntry[]): string {
  const header = [
    "Timestamp",
    "Status",
    "Action",
    "Module",
    "Record ID",
    "Performed By",
    "Role",
    "Team",
    "Dispatcher",
    "Approval Status",
    "Notes",
    "Previous Data",
    "Updated Data",
  ];

  const rows = entries.map((entry) =>
    [
      formatDate(entry.createdAt),
      entry.status,
      formatAuditAction(entry.action),
      deriveAuditModule(entry.entityType),
      entry.entityId ?? "",
      entry.actorName ?? "System",
      entry.actorRole ?? "",
      entry.teamName ?? "",
      entry.dispatcherName ?? "",
      entry.approvalStatus ?? "",
      entry.notes ?? "",
      entry.oldData ?? "",
      entry.newData ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export function AdminLogsPageContent() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadLogs = useCallback(
    () => fetchAdminLogs(buildParams(filters, 500)),
    [filters],
  );
  const { data, error, isLoading, reload } = useApiData(loadLogs, [filters]);

  const realtimeTables = useMemo(
    () => ["AuditLog", "DailyActivity", "ActivityEditRequest"] as const,
    [],
  );
  useRealtimeRefresh(realtimeTables, reload);

  const allEntries = useMemo(() => data ?? [], [data]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allEntries;

    return allEntries.filter((entry) =>
      [
        entry.actorName,
        entry.actorRole,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.teamName,
        entry.dispatcherName,
        entry.notes,
        entry.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [allEntries, search]);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const hasActiveFilters =
    filters.status !== FILTER_ALL ||
    filters.action !== FILTER_ALL ||
    filters.module !== FILTER_ALL ||
    filters.role !== FILTER_ALL ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(search.trim());

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const fullData = await fetchAdminLogs(buildParams(filters, 5000));
      const term = search.trim().toLowerCase();
      const exportEntries = term
        ? fullData.filter((entry) =>
            [
              entry.actorName,
              entry.actorRole,
              entry.action,
              entry.entityType,
              entry.entityId,
              entry.teamName,
              entry.dispatcherName,
              entry.notes,
              entry.status,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(term),
          )
        : fullData;

      if (exportEntries.length === 0) {
        setToastMessage("No audit logs to export for the current filters.");
        return;
      }

      const csv = entriesToCsv(exportEntries);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setToastMessage(`Exported ${exportEntries.length} audit logs.`);
    } catch {
      setToastMessage("Failed to export audit logs.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <PageShell
        title="Audit Logs"
        description="Complete record of every important action performed across the platform."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || Boolean(error) || isExporting}
          >
            <Download className="size-4" />
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      >
        <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Search" className="min-w-[200px] flex-[2] space-y-1">
              <Input
                placeholder="Search by user, action, record, notes…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FilterField>

            <FilterField label="Status">
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  updateFilter("status", value ?? FILTER_ALL)
                }
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All statuses</SelectItem>
                  {AUDIT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Module">
              <Select
                value={filters.module}
                onValueChange={(value) =>
                  updateFilter("module", value ?? FILTER_ALL)
                }
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All modules</SelectItem>
                  {AUDIT_MODULE_ENTITY_TYPES.map((entityType) => (
                    <SelectItem key={entityType} value={entityType}>
                      {deriveAuditModule(entityType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Role">
              <Select
                value={filters.role}
                onValueChange={(value) =>
                  updateFilter("role", value ?? FILTER_ALL)
                }
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All roles</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Action">
              <Select
                value={filters.action}
                onValueChange={(value) =>
                  updateFilter("action", value ?? FILTER_ALL)
                }
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All actions</SelectItem>
                  {ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAuditAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="From">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) =>
                  updateFilter("dateFrom", event.target.value)
                }
              />
            </FilterField>

            <FilterField label="To">
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
              />
            </FilterField>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
              >
                Reset
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Showing {visibleEntries.length} log
            {visibleEntries.length === 1 ? "" : "s"}.
          </p>
        </div>

        <PageContentGate
          state={pageState}
          onRetry={reload}
          emptyTitle="No log entries"
          emptyDescription="System activity will appear here as users work in the platform."
          errorTitle="Unable to load logs"
          errorDescription={error ?? undefined}
          loadingTitle="Loading logs"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Dispatcher</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Previous Data</TableHead>
                  <TableHead>Updated Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No log entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(entry.status)}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatAuditAction(entry.action)}</TableCell>
                      <TableCell>{deriveAuditModule(entry.entityType)}</TableCell>
                      <TableCell>
                        {entry.entityId
                          ? `${entry.entityId.slice(0, 8)}…`
                          : "—"}
                      </TableCell>
                      <TableCell>{entry.actorName ?? "System"}</TableCell>
                      <TableCell>{entry.actorRole ?? "—"}</TableCell>
                      <TableCell>{entry.teamName ?? "—"}</TableCell>
                      <TableCell>{entry.dispatcherName ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.notes ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">
                        {formatJson(entry.oldData)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">
                        {formatJson(entry.newData)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </PageContentGate>
      </PageShell>

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}
