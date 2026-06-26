"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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
import { useSession } from "@/components/auth/session-provider";
import {
  fetchNotifications,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "@/lib/api/resources";
import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_STATUS_LABELS,
  type NotificationStatus,
} from "@/lib/constants/notifications";
import { getNotificationHref } from "@/lib/notifications/notification-links";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format-date";

const PAGE_SIZE = 8;

const NOTIFICATION_STATUS_BADGE_CLASSES: Record<NotificationStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  CHANGES_REQUESTED: "border-orange-200 bg-orange-50 text-orange-900",
  ADMIN_APPROVAL_REQUIRED: "border-blue-200 bg-blue-50 text-blue-700",
  TEAM_LEAD_APPROVAL_REQUIRED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap",
        NOTIFICATION_STATUS_BADGE_CLASSES[status],
      )}
    >
      {NOTIFICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

function DateTimeCell({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="leading-tight">
      <div className="text-foreground">
        {formatDate(value, "MMM d, yyyy", "—")}
      </div>
      <div className="text-muted-foreground text-xs">
        {formatDate(value, "h:mm a", "")}
      </div>
    </div>
  );
}

export function NotificationsPageContent() {
  const router = useRouter();
  const { session } = useSession();
  const loadNotifications = useCallback(() => fetchNotifications(), []);
  const { data, error, isLoading, isEmpty, reload } = useApiData(
    loadNotifications,
    [],
  );
  const realtimeTables = useMemo(
    () => ["Notification", "DailyActivity", "ActivityEditRequest"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, reload);

  const notifications = useMemo<AppNotification[]>(
    () => data?.notifications ?? [],
    [data],
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const carrierOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of notifications) {
      if (item.carrierName) {
        names.add(item.carrierName);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [notifications]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return notifications.filter((item) => {
      if (statusFilter !== "all" && item.notificationStatus !== statusFilter) {
        return false;
      }
      if (carrierFilter !== "all" && item.carrierName !== carrierFilter) {
        return false;
      }
      if (dateFilter && item.activityDate !== dateFilter) {
        return false;
      }
      if (term) {
        const haystack = [item.title, item.message, item.carrierName ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [notifications, search, statusFilter, carrierFilter, dateFilter]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    carrierFilter !== "all" ||
    dateFilter.length > 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const handleOpenNotification = async (notification: AppNotification) => {
    if (!session) {
      return;
    }

    if (!notification.readAt) {
      await markNotificationReadRequest(notification.id);
      await reload();
    }

    router.push(getNotificationHref(session.role, notification));
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCarrierFilter("all");
    setDateFilter("");
    setPage(1);
  };

  return (
    <PageShell
      title="Notifications"
      description="View and manage system notifications"
      actions={
        <Button
          variant="outline"
          onClick={async () => {
            await markAllNotificationsReadRequest();
            await reload();
          }}
        >
          Mark all as read
        </Button>
      }
    >
      <PageContentGate
        state={pageState}
        onRetry={reload}
        emptyTitle="No notifications"
        emptyDescription="Approval updates and workflow alerts will appear here."
        errorTitle="Unable to load notifications"
        errorDescription={error ?? undefined}
        loadingTitle="Loading notifications"
      >
        <div className="bg-card ring-foreground/10 rounded-xl shadow-sm ring-1">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search notifications"
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) {
                    setStatusFilter(value);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {NOTIFICATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {NOTIFICATION_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={carrierFilter}
                onValueChange={(value) => {
                  if (value) {
                    setCarrierFilter(value);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="All carriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All carriers</SelectItem>
                  {carrierOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => {
                  setDateFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 w-[150px]"
              />

              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[940px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[12%] py-3">Title</TableHead>
                  <TableHead className="w-[23%] py-3">Message</TableHead>
                  <TableHead className="w-[13%] py-3">Status</TableHead>
                  <TableHead className="w-[11%] py-3">Carrier</TableHead>
                  <TableHead className="w-[10%] py-3">Activity Date</TableHead>
                  <TableHead className="w-[11%] py-3">Created</TableHead>
                  <TableHead className="w-[10%] py-3">Read</TableHead>
                  <TableHead className="w-[10%] py-3 text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground py-12 text-center"
                    >
                      No notifications match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((notification) => {
                    const isUnread = !notification.readAt;

                    return (
                      <TableRow
                        key={notification.id}
                        className={cn(isUnread && "bg-blue-50/50")}
                      >
                        <TableCell
                          className={cn(
                            "py-4 align-top whitespace-normal break-words",
                            isUnread ? "font-semibold" : "font-medium",
                          )}
                        >
                          <span className="flex items-start gap-1.5">
                            {isUnread ? (
                              <span
                                aria-hidden
                                className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-blue-500"
                              />
                            ) : null}
                            <span className="line-clamp-2">
                              {notification.title}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground py-4 align-top whitespace-normal break-words">
                          <span className="line-clamp-2">
                            {notification.message}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          <NotificationStatusBadge
                            status={notification.notificationStatus}
                          />
                        </TableCell>
                        <TableCell className="py-4 align-top whitespace-normal break-words">
                          {notification.carrierName ?? "—"}
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          {notification.activityDate ? (
                            <span>{notification.activityDate}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          <DateTimeCell value={notification.createdAt} />
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          {notification.readAt ? (
                            <DateTimeCell value={notification.readAt} />
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-blue-700"
                            >
                              Unread
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-right align-top">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void handleOpenNotification(notification);
                            }}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-muted-foreground flex flex-col items-center justify-between gap-3 border-t p-4 text-sm sm:flex-row">
            <span>
              {filtered.length === 0
                ? "0 notifications"
                : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                    currentPage * PAGE_SIZE,
                    filtered.length,
                  )} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                Previous
              </Button>
              <span className="px-1">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </PageContentGate>
    </PageShell>
  );
}
