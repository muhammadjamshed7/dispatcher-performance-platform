"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";

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
  AUDIT_EMPTY_VALUE,
  AUDIT_MODULE_ENTITY_TYPES,
  AUDIT_STATUSES,
  deriveAuditModule,
  formatAuditAction,
  formatAuditData,
  formatAuditDataLines,
} from "@/lib/audit/audit-log-format";
import { fetchAdminLogs, recordAuditExportEvent } from "@/lib/api/resources";
import { exportAuditLogsPdf } from "@/lib/reports/export-audit-logs-pdf";
import type { AuditLogEntry } from "@/lib/types";
import { escapeCsvCell } from "@/lib/utils/csv";
import { formatDate } from "@/lib/utils/format-date";

const FILTER_ALL = "all";

const ACTIONS: AuditLogEntry["action"][] = [
  "USER_LOGGED_IN",
  "USER_LOGGED_OUT",
  "USER_LOGIN_FAILED",
  "USER_APPROVED",
  "USER_MANUALLY_CREATED",
  "USER_PASSWORD_RESET",
  "USER_PASSWORD_CHANGED",
  "USER_REJECTED",
  "USER_ROLE_ASSIGNED",
  "USER_TEAM_ASSIGNED",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "TEAM_CREATED",
  "TEAM_UPDATED",
  "TEAM_ACTIVATED",
  "TEAM_DEACTIVATED",
  "TEAM_LEAD_CREATED",
  "TEAM_LEAD_ASSIGNED",
  "DISPATCHER_CREATED",
  "DISPATCHER_UPDATED",
  "DISPATCHER_REACTIVATED",
  "DISPATCHER_DEACTIVATED",
  "CARRIER_CREATED",
  "CARRIER_UPDATED",
  "CARRIER_ACTIVATED",
  "CARRIER_DEACTIVATED",
  "CARRIER_REASSIGNED",
  "CARRIER_EXPORTED",
  "ACTIVITY_CREATED",
  "ACTIVITY_UPDATED",
  "ACTIVITY_SUBMITTED",
  "ACTIVITY_EDIT_REQUEST_SUBMITTED",
  "ACTIVITY_APPROVED_BY_TEAM_LEAD",
  "ACTIVITY_APPROVED_BY_ADMIN",
  "ACTIVITY_REJECTED",
  "ACTIVITY_CHANGES_REQUESTED",
  "ACTIVITY_PENDING_UPDATED",
  "ACTIVITY_EXPORTED",
  "SETTINGS_UPDATED",
  "SETTINGS_DISPATCH_FEE_RULES_UPDATED",
  "SETTINGS_TRUCK_TYPES_UPDATED",
  "SETTINGS_STATUS_REASONS_UPDATED",
  "SETTINGS_DIRECT_APPROVAL_UPDATED",
  "NOTIFICATION_READ",
  "NOTIFICATION_MARK_ALL_READ",
  "REPORT_VIEWED",
  "REPORT_EXPORTED",
  "FINANCE_VIEWED",
  "FINANCE_EXPORTED",
  "AUDIT_LOGS_EXPORTED",
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
  if (status === "Logged In" || status === "Logged Out" || status === "Viewed")
    return "secondary";
  if (status === "Failed") return "destructive";
  return "outline";
}

function AuditDataCell({ value }: { value: Record<string, unknown> | null }) {
  const lines = formatAuditDataLines(value);

  if (lines.length === 0) {
    return <span className="text-muted-foreground">{AUDIT_EMPTY_VALUE}</span>;
  }

  return (
    <div className="max-h-16 space-y-0.5 overflow-hidden">
      {lines.map((line, index) => (
        <div key={index} className="truncate">
          {line.label ? (
            <>
              <span className="font-medium">{line.label}:</span> {line.value}
            </>
          ) : (
            line.value
          )}
        </div>
      ))}
    </div>
  );
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return escapeCsvCell(text);
}

function entriesToCsv(entries: AuditLogEntry[]): string {
  const header = [
    "Date/Time",
    "Actor Name",
    "Actor Email",
    "Actor Role",
    "Action",
    "Module",
    "Entity Type",
    "Entity Name/ID",
    "Status",
    "Message",
    "Metadata / Details",
    "Before Values",
    "After Values",
  ];

  const rows = entries.map((entry) =>
    [
      formatDate(entry.createdAt),
      entry.actorName ?? "System",
      entry.actorEmail ?? "",
      entry.actorRole ?? "",
      formatAuditAction(entry.action),
      deriveAuditModule(entry.entityType),
      entry.entityType,
      entry.entityName ?? entry.entityId ?? "",
      entry.status,
      entry.message ?? entry.notes ?? "",
      formatAuditData(entry.metadata),
      formatAuditData(entry.oldData),
      formatAuditData(entry.newData),
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
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

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
        entry.actorEmail,
        entry.actorRole,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.entityName,
        entry.teamName,
        entry.dispatcherName,
        entry.message,
        entry.notes,
        entry.status,
        JSON.stringify(entry.metadata ?? {}),
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

  const collectExportEntries = useCallback(async () => {
    const fullData = await fetchAdminLogs(buildParams(filters, 5000));
    const term = search.trim().toLowerCase();

    if (!term) {
      return fullData;
    }

    return fullData.filter((entry) =>
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
  }, [filters, search]);

  const buildFilterSummary = useCallback((): string[] => {
    const lines: string[] = [];

    if (filters.status !== FILTER_ALL) lines.push(`Status: ${filters.status}`);
    if (filters.action !== FILTER_ALL) {
      lines.push(`Action: ${formatAuditAction(filters.action)}`);
    }
    if (filters.module !== FILTER_ALL) {
      lines.push(`Module: ${deriveAuditModule(filters.module)}`);
    }
    if (filters.role !== FILTER_ALL) {
      lines.push(`Role: ${filters.role.replaceAll("_", " ")}`);
    }
    if (filters.dateFrom) lines.push(`From: ${filters.dateFrom}`);
    if (filters.dateTo) lines.push(`To: ${filters.dateTo}`);
    if (search.trim()) lines.push(`Search: "${search.trim()}"`);

    if (lines.length === 0) {
      return ["Filters: All audit logs"];
    }

    return lines;
  }, [filters, search]);

  async function handleExportCsv() {
    setExporting("csv");
    try {
      const exportEntries = await collectExportEntries();

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
      await recordAuditExportEvent({
        action: "AUDIT_LOGS_EXPORTED",
        entityType: "AuditLog",
        entityName: "Audit Logs CSV",
        format: "csv",
        rowCount: exportEntries.length,
        filters: {
          ...buildParams(filters, 5000),
          search: search.trim() || undefined,
        },
        metadata: { fileName },
      }).catch((auditError) => {
        console.error("Failed to record audit logs CSV export audit event", {
          auditError,
        });
      });
      setToastMessage(`Exported ${exportEntries.length} audit logs.`);
    } catch {
      setToastMessage("Failed to export audit logs.");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    setExporting("pdf");
    try {
      const exportEntries = await collectExportEntries();

      if (exportEntries.length === 0) {
        setToastMessage("No audit logs to export for the current filters.");
        return;
      }

      await exportAuditLogsPdf({
        entries: exportEntries,
        filterSummary: buildFilterSummary(),
      });
      await recordAuditExportEvent({
        action: "AUDIT_LOGS_EXPORTED",
        entityType: "AuditLog",
        entityName: "Audit Logs PDF",
        format: "pdf",
        rowCount: exportEntries.length,
        filters: {
          ...buildParams(filters, 5000),
          search: search.trim() || undefined,
        },
      }).catch((auditError) => {
        console.error("Failed to record audit logs PDF export audit event", {
          auditError,
        });
      });
      setToastMessage(`Exported ${exportEntries.length} audit logs to PDF.`);
    } catch {
      setToastMessage("Failed to export audit logs to PDF.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <PageShell
        title="Audit Logs"
        description="Complete record of every important action performed across the platform."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={isLoading || Boolean(error) || exporting !== null}
            >
              <Download className="size-4" />
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPdf}
              disabled={isLoading || Boolean(error) || exporting !== null}
            >
              <FileText className="size-4" />
              {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <FilterField
              label="Search"
              className="min-w-[200px] flex-[2] space-y-1"
            >
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
                  <TableHead>Entity</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Actor Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Dispatcher</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={14}
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
                      <TableCell>
                        {deriveAuditModule(entry.entityType)}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="truncate">
                          {entry.entityName ??
                            (entry.entityId
                              ? `${entry.entityId.slice(0, 8)}…`
                              : "—")}
                        </div>
                      </TableCell>
                      <TableCell>{entry.actorName ?? "System"}</TableCell>
                      <TableCell>{entry.actorEmail ?? "—"}</TableCell>
                      <TableCell>{entry.actorRole ?? "—"}</TableCell>
                      <TableCell>{entry.teamName ?? "—"}</TableCell>
                      <TableCell>{entry.dispatcherName ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.message ?? entry.notes ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <AuditDataCell value={entry.oldData} />
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <AuditDataCell value={entry.newData} />
                      </TableCell>
                      <TableCell className="max-w-[240px] text-xs">
                        <AuditDataCell value={entry.metadata} />
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
