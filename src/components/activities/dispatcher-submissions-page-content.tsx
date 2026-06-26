"use client";

import { useCallback, useMemo } from "react";

import { ActivityApprovalBadge } from "@/components/activities/activity-approval-badge";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/status-badge";
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
import { fetchDispatcherSubmissions } from "@/lib/api/resources";
import { EDIT_ACTIVITY } from "@/lib/constants/activity-approval";
import { formatDate } from "@/lib/utils/format-date";

export function DispatcherSubmissionsPageContent() {
  const loadSubmissions = useCallback(() => fetchDispatcherSubmissions(), []);
  const { data, error, isLoading, isEmpty, reload } = useApiData(
    loadSubmissions,
    [],
  );
  const realtimeTables = useMemo(
    () =>
      ["DailyActivity", "ActivityEditRequest", "Notification"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, reload);
  const items = useMemo(() => data ?? [], [data]);
  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  return (
    <PageShell title="My Submissions">
      <RoleScopeBanner />
      <PageContentGate
        state={pageState}
        onRetry={reload}
        emptyTitle="No submissions"
        emptyDescription="Pending, rejected, and edit requests will appear here."
        errorTitle="Unable to load submissions"
        errorDescription={error ?? undefined}
        loadingTitle="Loading submissions"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Rejection Reason</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  No pending or rejected submissions.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell>
                    {item.approvalType === EDIT_ACTIVITY ? "Edit" : "New"}
                  </TableCell>
                  <TableCell>{formatDate(item.activityDate)}</TableCell>
                  <TableCell>{item.carrierName}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <ActivityApprovalBadge approvalStatus={item.approvalStatus} />
                  </TableCell>
                  <TableCell>{item.rejectionReason ?? "—"}</TableCell>
                  <TableCell>
                    {formatDate(item.submittedAt ?? item.editedAt ?? "")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </PageContentGate>
    </PageShell>
  );
}
