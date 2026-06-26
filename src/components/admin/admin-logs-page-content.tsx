"use client";

import { useCallback, useMemo } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
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
import { fetchAdminLogs } from "@/lib/api/resources";
import { formatDate } from "@/lib/utils/format-date";

function formatJson(value: Record<string, unknown> | null) {
  if (!value) return "—";
  return JSON.stringify(value);
}

export function AdminLogsPageContent() {
  const loadLogs = useCallback(() => fetchAdminLogs(), []);
  const { data, error, isLoading, isEmpty, reload } = useApiData(loadLogs, []);
  const realtimeTables = useMemo(
    () => ["AuditLog", "DailyActivity", "ActivityEditRequest"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, reload);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  return (
    <PageShell title="System Logs">
      <RoleScopeBanner />
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
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Dispatcher</TableHead>
                <TableHead>Approval Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Old Data</TableHead>
                <TableHead>New Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-8 text-center">
                    No log entries found.
                  </TableCell>
                </TableRow>
              ) : (
                (data ?? []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>
                      {entry.entityType}
                      {entry.entityId ? ` (${entry.entityId.slice(0, 8)}…)` : ""}
                    </TableCell>
                    <TableCell>{entry.actorName ?? "System"}</TableCell>
                    <TableCell>{entry.actorRole ?? "—"}</TableCell>
                    <TableCell>{entry.teamName ?? "—"}</TableCell>
                    <TableCell>{entry.dispatcherName ?? "—"}</TableCell>
                    <TableCell>{entry.approvalStatus ?? "—"}</TableCell>
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
  );
}
