"use client";

import { useCallback, useMemo, useState } from "react";
import { Eye, MoreHorizontal } from "lucide-react";

import { ActivityApprovalBadge } from "@/components/activities/activity-approval-badge";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { ActivityModal } from "@/components/modals/activity-modal";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ApiClientError } from "@/lib/api/client";
import {
  approveActivityRequest,
  fetchPendingActivities,
  rejectActivityRequest,
} from "@/lib/api/resources";
import { ADMIN } from "@/lib/constants/roles";
import { useSession } from "@/components/auth/session-provider";
import type { DailyActivity } from "@/lib/types";
import { formatActivityDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

type DialogMode = "reject" | "request-changes" | null;

export function PendingActivitiesPageContent() {
  const { session } = useSession();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(
    null,
  );
  const [viewOpen, setViewOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPending = useCallback(() => fetchPendingActivities(), []);
  const {
    data: activities = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadPending, []);

  const realtimeTables = useMemo(
    () => ["DailyActivity", "ActivityEditRequest"] as const,
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

  const showToast = (message: string) => setToastMessage(message);

  const handleApprove = async (activity: DailyActivity) => {
    try {
      await approveActivityRequest(activity.id);
      showToast(
        session?.role === ADMIN
          ? "Activity approved."
          : "Activity forwarded to admin for final approval.",
      );
      reload();
    } catch (approveError) {
      showToast(getErrorMessage(approveError, "Unable to approve activity."));
    }
  };

  const openRejectDialog = (
    activity: DailyActivity,
    mode: Exclude<DialogMode, null>,
  ) => {
    setSelectedActivity(activity);
    setDialogMode(mode);
    setReason("");
  };

  const handleRejectSubmit = async () => {
    if (!selectedActivity || !dialogMode) {
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectActivityRequest(selectedActivity.id, {
        reason,
        requestChanges: dialogMode === "request-changes",
      });
      showToast(
        dialogMode === "request-changes"
          ? "Changes requested. The dispatcher can revise and resubmit."
          : "Activity rejected.",
      );
      setDialogMode(null);
      setSelectedActivity(null);
      setReason("");
      reload();
    } catch (rejectError) {
      showToast(getErrorMessage(rejectError, "Unable to reject activity."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageShell
        title="Pending Activity Approvals"
        description="Review dispatcher-submitted daily activities before they affect reports and dashboards."
      >
        <RoleScopeBanner />

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading pending activities"
          emptyTitle="No pending activities"
          emptyDescription="Submitted activities awaiting approval will appear here."
          errorTitle="Unable to load pending activities"
          errorDescription={
            error ?? "Pending activities could not be loaded. Try again."
          }
        >
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Dispatcher</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Load Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Load Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      {activity.submittedAt
                        ? formatActivityDate(activity.submittedAt.slice(0, 10))
                        : "—"}
                    </TableCell>
                    <TableCell>{formatActivityDate(activity.date)}</TableCell>
                    <TableCell className="font-medium">
                      {activity.carrierName}
                    </TableCell>
                    <TableCell>{activity.dispatcherName}</TableCell>
                    <TableCell>{activity.teamName}</TableCell>
                    <TableCell>
                      <StatusBadge status={activity.status} />
                    </TableCell>
                    <TableCell>
                      <ActivityApprovalBadge
                        approvalStatus={activity.approvalStatus}
                      />
                    </TableCell>
                    <TableCell>
                      {formatCurrency(activity.loadAmount, { nullLabel: "—" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${activity.carrierName}`}
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedActivity(activity);
                              setViewOpen(true);
                            }}
                          >
                            <Eye className="size-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void handleApprove(activity)}
                          >
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              openRejectDialog(activity, "request-changes")
                            }
                          >
                            Request Changes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openRejectDialog(activity, "reject")}
                          >
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PageContentGate>
      </PageShell>

      <ActivityModal
        open={viewOpen}
        mode="view"
        activity={selectedActivity}
        allowedStatusReasons={[]}
        onOpenChange={setViewOpen}
        onCreate={async () => undefined}
        onEdit={async () => undefined}
      />

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "request-changes"
                ? "Request Changes"
                : "Reject Activity"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "request-changes"
                ? "Explain what the dispatcher should update before resubmitting."
                : "Provide a reason for rejecting this activity."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-reason">Reason</Label>
            <Textarea
              id="approval-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Enter feedback for the dispatcher"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogMode(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!reason.trim() || isSubmitting}
              onClick={() => void handleRejectSubmit()}
            >
              {dialogMode === "request-changes"
                ? "Request Changes"
                : "Reject Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}
