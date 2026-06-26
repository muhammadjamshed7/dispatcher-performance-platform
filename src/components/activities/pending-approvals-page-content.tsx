"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, MoreHorizontal } from "lucide-react";

import { ActivityApprovalBadge } from "@/components/activities/activity-approval-badge";
import {
  ActivityChangeComparison,
  formatChangeValue,
} from "@/components/details/activity-change-comparison";
import { ActivityDetailView } from "@/components/details/activity-detail-view";
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
import { Badge } from "@/components/ui/badge";
import { EDIT_ACTIVITY } from "@/lib/constants/activity-approval";
import { matchesPendingApprovalDeepLink } from "@/lib/notifications/notification-links";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import { formatNullableText } from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import type { PendingApprovalItem } from "@/lib/types";

type ModalAction = "view" | "approve" | "reject" | "request-changes" | null;
const DATETIME_PATTERN = "MMM d, yyyy 'at' h:mm a";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

type ReviewRow = {
  label: string;
  value: ReactNode;
};

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-background overflow-hidden rounded-lg border">
      <div className="bg-muted/20 border-b px-5 py-4">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-5 py-2">{children}</div>
    </section>
  );
}

function KeyValueTable({ rows }: { rows: ReviewRow[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b align-top last:border-0">
            <th className="text-muted-foreground bg-muted/20 w-[38%] py-3 pr-4 pl-4 text-left text-sm leading-6 font-medium sm:w-[32%]">
              {row.label}
            </th>
            <td className="text-foreground min-w-0 py-3 pr-4 pl-5 leading-6 font-medium break-words whitespace-normal">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatEditValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (key === "loadAmount" || key === "dispatchFee") {
    return formatCurrency(toFiniteNumber(value), { nullLabel: "N/A" });
  }

  if (key === "ratePerMile") {
    return formatRatePerMile(toFiniteNumber(value), "N/A");
  }

  if (key === "totalMiles" || key === "miles") {
    return toFiniteNumber(value)?.toString() ?? "N/A";
  }

  return formatNullableText(formatChangeValue(key, value), "N/A");
}

function getEditValue(item: PendingApprovalItem, key: string): unknown {
  const proposed = item.editRequest?.proposedChanges?.[key];
  const previous = item.editRequest?.previousData?.[key];
  return proposed ?? previous ?? null;
}

function EditRequestReview({ item }: { item: PendingApprovalItem }) {
  const basicRows: ReviewRow[] = [
    {
      label: "Activity Type",
      value: <Badge variant="outline">Edit</Badge>,
    },
    {
      label: "Activity Date",
      value: item.activityDate ? formatDate(item.activityDate) : "N/A",
    },
    { label: "Carrier", value: item.carrierName || "N/A" },
    { label: "Dispatcher", value: item.dispatcherName || "N/A" },
    { label: "Team", value: item.teamName || "N/A" },
    {
      label: "Load Status",
      value: <StatusBadge status={item.status} />,
    },
    {
      label: "Approval Status",
      value: <ActivityApprovalBadge approvalStatus={item.approvalStatus} />,
    },
    {
      label: "Edited By",
      value: item.editedByName ?? "N/A",
    },
  ];

  const loadRows: ReviewRow[] = [
    {
      label: "Origin (Pickup)",
      value: formatEditValue("origin", getEditValue(item, "origin")),
    },
    {
      label: "Destination (Drop-off)",
      value: formatEditValue("destination", getEditValue(item, "destination")),
    },
    {
      label: "Total Miles",
      value: formatEditValue("totalMiles", getEditValue(item, "totalMiles")),
    },
    {
      label: "Load Amount",
      value: formatEditValue("loadAmount", getEditValue(item, "loadAmount")),
    },
    {
      label: "Rate Per Mile",
      value: formatEditValue("ratePerMile", getEditValue(item, "ratePerMile")),
    },
    {
      label: "Dispatch Fee Earned",
      value: formatEditValue("dispatchFee", getEditValue(item, "dispatchFee")),
    },
  ];

  const notesRows: ReviewRow[] = [
    {
      label: "Reason",
      value: (
        <span className="whitespace-pre-wrap">
          {formatEditValue("reason", getEditValue(item, "reason"))}
        </span>
      ),
    },
    {
      label: "Notes",
      value: (
        <span className="whitespace-pre-wrap">
          {formatEditValue("notes", getEditValue(item, "notes"))}
        </span>
      ),
    },
  ];

  const timelineRows: ReviewRow[] = [
    {
      label: "Submitted",
      value: formatDate(item.submittedAt, DATETIME_PATTERN, "N/A"),
    },
    {
      label: "Edited",
      value: formatDate(item.editedAt, DATETIME_PATTERN, "N/A"),
    },
    {
      label: "Team Lead Approved",
      value: formatDate(
        item.editRequest?.teamLeadApprovedAt,
        DATETIME_PATTERN,
        "N/A",
      ),
    },
    {
      label: "Admin Approved",
      value: formatDate(
        item.editRequest?.adminApprovedAt,
        DATETIME_PATTERN,
        "N/A",
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <ReviewSection title="Basic Activity Information">
            <KeyValueTable rows={basicRows} />
          </ReviewSection>

          <ReviewSection title="Notes & Reason">
            <KeyValueTable rows={notesRows} />
          </ReviewSection>
        </div>

        <div className="space-y-5">
          <ReviewSection title="Load & Work Details">
            <KeyValueTable rows={loadRows} />
          </ReviewSection>

          <ReviewSection title="Approval Timeline">
            <KeyValueTable rows={timelineRows} />
          </ReviewSection>
        </div>
      </div>

      <ReviewSection title="Edited Activity Comparison">
        <ActivityChangeComparison
          previousData={item.editRequest?.previousData}
          proposedChanges={item.editRequest?.proposedChanges}
        />
      </ReviewSection>
    </div>
  );
}

export function PendingApprovalsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
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
  const { data, error, isLoading, isEmpty, reload } = useApiData(
    loadPending,
    [],
  );
  const realtimeTables = useMemo(
    () => ["DailyActivity", "ActivityEditRequest", "Notification"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, reload);

  const items = useMemo(() => data ?? [], [data]);
  const deepLinkKey = `${deepLinkActivityId ?? ""}|${deepLinkEditRequestId ?? ""}`;
  const [dismissedDeepLinkKey, setDismissedDeepLinkKey] = useState<
    string | null
  >(null);

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
  const activeItem =
    selected ?? (shouldAutoOpenDeepLink ? deepLinkedItem : null);
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

    // Strip the deep-link query (?activityId / ?editRequestId) so a resolved
    // item does not re-open the modal and the URL stays clean after acting.
    if (deepLinkActivityId || deepLinkEditRequestId) {
      router.replace(pathname);
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
                  <TableCell
                    colSpan={9}
                    className="text-muted-foreground py-8 text-center"
                  >
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
                      <ActivityApprovalBadge
                        approvalStatus={item.approvalStatus}
                      />
                    </TableCell>
                    <TableCell>
                      {formatDate(item.submittedAt ?? item.editedAt ?? "")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Actions"
                            />
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

      <Dialog
        open={activeModalAction !== null}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent className="flex h-[94vh] w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[92vh] sm:w-[90vw] sm:!max-w-[90vw] xl:!max-w-[1400px]">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-xl leading-7 font-semibold">
                  Approval details
                </DialogTitle>
                <DialogDescription className="break-words">
                  {activeItem
                    ? `${activeItem.dispatcherName || activeItem.carrierName || "Submission"} · ${activeItem.activityDate || "No date"}`
                    : "Review submission"}
                </DialogDescription>
              </div>
              {activeItem ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  >
                    {activeItem.approvalType === EDIT_ACTIVITY ? "Edit" : "New"}
                  </Badge>
                  <StatusBadge status={activeItem.status} />
                  <ActivityApprovalBadge
                    approvalStatus={activeItem.approvalStatus}
                  />
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="bg-muted/20 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-5 px-5 py-5 pb-10 sm:px-6 lg:px-8">
              {activeItem?.kind === "edit_request" ? (
                <EditRequestReview item={activeItem} />
              ) : activeItem?.kind === "new_activity" &&
                activeItem.id === "" ? (
                <div className="hidden">
                  <div className="bg-muted/30 grid gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailItem label="Activity Type" value="Edit request" />
                    <DetailItem
                      label="Approval Status"
                      value={
                        <ActivityApprovalBadge
                          approvalStatus={activeItem.approvalStatus}
                        />
                      }
                    />
                    <DetailItem
                      label="Carrier"
                      value={activeItem.carrierName || "—"}
                    />
                    <DetailItem
                      label="Dispatcher"
                      value={activeItem.dispatcherName || "—"}
                    />
                    <DetailItem
                      label="Team"
                      value={activeItem.teamName || "—"}
                    />
                    <DetailItem
                      label="Load Status"
                      value={<StatusBadge status={activeItem.status} />}
                    />
                    <DetailItem
                      label="Activity Date"
                      value={
                        activeItem.activityDate
                          ? formatDate(activeItem.activityDate)
                          : "—"
                      }
                    />
                    <DetailItem
                      label="Edited By"
                      value={activeItem.editedByName ?? "—"}
                    />
                    <DetailItem
                      label="Edited At"
                      value={formatDate(activeItem.editedAt ?? "")}
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">
                      Edited Activity Comparison
                    </p>
                    <p className="text-muted-foreground mb-3 text-xs">
                      Review exactly what the dispatcher changed before
                      approving or rejecting.
                    </p>
                    <ActivityChangeComparison
                      previousData={activeItem.editRequest?.previousData}
                      proposedChanges={activeItem.editRequest?.proposedChanges}
                    />
                  </div>
                </div>
              ) : activeItem?.activity ? (
                <ActivityDetailView activity={activeItem.activity} />
              ) : null}

              {activeModalAction !== "view" ? (
                <ReviewSection
                  title={
                    activeModalAction === "approve"
                      ? "Approval Notes"
                      : "Decision Details"
                  }
                >
                  <div className="space-y-4 py-3">
                    {activeModalAction !== "approve" ? (
                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                          id="reason"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          rows={4}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="approvalNotes">Notes (optional)</Label>
                      <Input
                        id="approvalNotes"
                        value={approvalNotes}
                        onChange={(event) =>
                          setApprovalNotes(event.target.value)
                        }
                      />
                    </div>
                    {modalError ? (
                      <p className="text-sm text-red-600">{modalError}</p>
                    ) : null}
                  </div>
                </ReviewSection>
              ) : null}
            </div>
          </div>

          {activeModalAction !== "view" ? (
            <DialogFooter className="bg-background !mx-0 !mb-0 shrink-0 flex-wrap gap-2 rounded-none px-5 py-4 sm:px-6 lg:px-8">
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
            <DialogFooter className="bg-background !mx-0 !mb-0 shrink-0 flex-wrap gap-2 rounded-none px-5 py-4 sm:px-6 lg:px-8">
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setModalError(null);
                  setModalAction("request-changes");
                }}
              >
                Request changes
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setModalError(null);
                  setModalAction("reject");
                }}
              >
                Reject
              </Button>
              <Button disabled={isSubmitting} onClick={handleApprove}>
                {isSubmitting ? "Approving..." : "Approve"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {toastMessage ? (
        <AppToast
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      ) : null}
    </PageShell>
  );
}
