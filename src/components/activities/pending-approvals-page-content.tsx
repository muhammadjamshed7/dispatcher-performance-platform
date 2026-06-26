"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, MoreHorizontal } from "lucide-react";

import { ActivityApprovalBadge } from "@/components/activities/activity-approval-badge";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
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
import { Input } from "@/components/ui/input";
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
  approveEditRequestRequest,
  fetchPendingApprovals,
  rejectActivityRequest,
  rejectEditRequestRequest,
} from "@/lib/api/resources";
import { EDIT_ACTIVITY } from "@/lib/constants/activity-approval";
import { matchesPendingApprovalDeepLink } from "@/lib/notifications/notification-links";
import { formatDate } from "@/lib/utils/format-date";
import type { PendingApprovalItem } from "@/lib/types";

type ModalAction = "view" | "approve" | "reject" | "request-changes" | null;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value) return "—";
  return JSON.stringify(value, null, 2);
}

export function PendingApprovalsPageContent() {
  const searchParams = useSearchParams();
  const deepLinkActivityId = searchParams.get("activityId");
  const deepLinkEditRequestId = searchParams.get("editRequestId");
  const [selected, setSelected] = useState<PendingApprovalItem | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [reason, setReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPending = useCallback(() => fetchPendingApprovals(), []);
  const { data, error, isLoading, isEmpty, reload } = useApiData(loadPending, []);
  const realtimeTables = useMemo(
    () =>
      ["DailyActivity", "ActivityEditRequest", "Notification"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, reload);

  const items = useMemo(() => data ?? [], [data]);
  const deepLinkKey = `${deepLinkActivityId ?? ""}|${deepLinkEditRequestId ?? ""}`;
  const [dismissedDeepLinkKey, setDismissedDeepLinkKey] = useState<string | null>(
    null,
  );

  const deepLinkedItem = useMemo(() => {
    if (!deepLinkActivityId && !deepLinkEditRequestId) {
      return null;
    }

    return (
      items.find((item) =>
        matchesPendingApprovalDeepLink(item, {
          activityId: deepLinkActivityId,
          editRequestId: deepLinkEditRequestId,
        }),
      ) ?? null
    );
  }, [deepLinkActivityId, deepLinkEditRequestId, items]);

  const shouldAutoOpenDeepLink =
    deepLinkedItem !== null && dismissedDeepLinkKey !== deepLinkKey;
  const activeItem = selected ?? (shouldAutoOpenDeepLink ? deepLinkedItem : null);
  const activeModalAction =
    modalAction ?? (shouldAutoOpenDeepLink ? ("view" as const) : null);
  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const closeModal = () => {
    if (shouldAutoOpenDeepLink) {
      setDismissedDeepLinkKey(deepLinkKey);
    }

    setSelected(null);
    setModalAction(null);
    setReason("");
    setApprovalNotes("");
    setModalError(null);
  };

  const handleApprove = async () => {
    if (!activeItem) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      if (activeItem.kind === "new_activity") {
        await approveActivityRequest(activeItem.id, {
          approvalNotes: approvalNotes.trim() || undefined,
        });
      } else {
        await approveEditRequestRequest(activeItem.id, {
          approvalNotes: approvalNotes.trim() || undefined,
        });
      }
      setToastMessage("Approval recorded successfully.");
      closeModal();
      await reload();
    } catch (error) {
      setModalError(getErrorMessage(error, "Unable to approve."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (requestChanges: boolean) => {
    if (!activeItem || !reason.trim()) {
      setModalError("A reason is required.");
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        reason: reason.trim(),
        requestChanges,
        approvalNotes: approvalNotes.trim() || undefined,
      };
      if (activeItem.kind === "new_activity") {
        await rejectActivityRequest(activeItem.id, payload);
      } else {
        await rejectEditRequestRequest(activeItem.id, payload);
      }
      setToastMessage(
        requestChanges ? "Changes requested." : "Submission rejected.",
      );
      closeModal();
      await reload();
    } catch (error) {
      setModalError(getErrorMessage(error, "Unable to reject."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell title="Pending Approvals">
      <RoleScopeBanner />
      <PageContentGate
        state={pageState}
        onRetry={reload}
        emptyTitle="No pending approvals"
        emptyDescription="New submissions and edit requests will appear here."
        errorTitle="Unable to load pending approvals"
        errorDescription={error ?? undefined}
        loadingTitle="Loading pending approvals"
      >
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Dispatcher</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                    No pending approvals.
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
                    <TableCell>{item.dispatcherName}</TableCell>
                    <TableCell>{item.teamName}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <ActivityApprovalBadge approvalStatus={item.approvalStatus} />
                    </TableCell>
                    <TableCell>
                      {formatDate(item.submittedAt ?? item.editedAt ?? "")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Actions" />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelected(item);
                              setModalAction("view");
                            }}
                          >
                            <Eye className="mr-2 size-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelected(item);
                              setModalAction("approve");
                            }}
                          >
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelected(item);
                              setModalAction("reject");
                            }}
                          >
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelected(item);
                              setModalAction("request-changes");
                            }}
                          >
                            Request changes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageContentGate>

      <Dialog open={activeModalAction !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeModalAction === "view"
                ? "Approval details"
                : activeModalAction === "approve"
                  ? "Approve submission"
                  : activeModalAction === "request-changes"
                    ? "Request changes"
                    : "Reject submission"}
            </DialogTitle>
            <DialogDescription>
              {activeItem?.carrierName} · {activeItem?.activityDate}
            </DialogDescription>
          </DialogHeader>

          {activeItem?.kind === "edit_request" && activeItem.editRequest ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Original data</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
                  {formatJson(activeItem.editRequest.previousData)}
                </pre>
              </div>
              <div>
                <p className="font-medium">Proposed changes</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
                  {formatJson(activeItem.editRequest.proposedChanges)}
                </pre>
              </div>
              <p>
                Edited by: {activeItem.editedByName ?? "Unknown"} ·{" "}
                {formatDate(activeItem.editedAt ?? "")}
              </p>
            </div>
          ) : activeItem?.activity ? (
            <div className="space-y-2 text-sm">
              <p>Dispatcher: {activeItem.activity.dispatcherName}</p>
              <p>Load status: {activeItem.activity.status}</p>
              <ActivityApprovalBadge approvalStatus={activeItem.activity.approvalStatus} />
            </div>
          ) : null}

          {activeModalAction !== "view" ? (
            <div className="space-y-3">
              {activeModalAction !== "approve" ? (
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="approvalNotes">Notes (optional)</Label>
                <Input
                  id="approvalNotes"
                  value={approvalNotes}
                  onChange={(event) => setApprovalNotes(event.target.value)}
                />
              </div>
              {modalError ? (
                <p className="text-sm text-red-600">{modalError}</p>
              ) : null}
            </div>
          ) : null}

          {activeModalAction !== "view" ? (
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              {activeModalAction === "approve" ? (
                <Button disabled={isSubmitting} onClick={handleApprove}>
                  Approve
                </Button>
              ) : (
                <Button
                  disabled={isSubmitting}
                  variant="destructive"
                  onClick={() =>
                    handleReject(activeModalAction === "request-changes")
                  }
                >
                  {activeModalAction === "request-changes"
                    ? "Request changes"
                    : "Reject"}
                </Button>
              )}
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button onClick={closeModal}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {toastMessage ? (
        <AppToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}
    </PageShell>
  );
}
