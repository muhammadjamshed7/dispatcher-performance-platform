"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
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
import { NOTIFICATION_STATUS_LABELS } from "@/lib/constants/notifications";
import { getNotificationHref } from "@/lib/notifications/notification-links";
import { formatDate } from "@/lib/utils/format-date";

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

  const notifications = data?.notifications ?? [];
  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const handleOpenNotification = async (
    notification: (typeof notifications)[number],
  ) => {
    if (!session) {
      return;
    }

    if (!notification.readAt) {
      await markNotificationReadRequest(notification.id);
      await reload();
    }

    router.push(getNotificationHref(session.role, notification));
  };

  return (
    <PageShell title="Notifications">
      <PageContentGate
        state={pageState}
        onRetry={reload}
        emptyTitle="No notifications"
        emptyDescription="Approval updates and workflow alerts will appear here."
        errorTitle="Unable to load notifications"
        errorDescription={error ?? undefined}
        loadingTitle="Loading notifications"
      >
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            onClick={async () => {
              await markAllNotificationsReadRequest();
              await reload();
            }}
          >
            Mark all as read
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Read</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                  No notifications.
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>{notification.title}</TableCell>
                  <TableCell className="max-w-[320px]">{notification.message}</TableCell>
                  <TableCell>
                    {NOTIFICATION_STATUS_LABELS[notification.notificationStatus]}
                  </TableCell>
                  <TableCell>{notification.carrierName ?? "—"}</TableCell>
                  <TableCell>{notification.activityDate ?? "—"}</TableCell>
                  <TableCell>{formatDate(notification.createdAt)}</TableCell>
                  <TableCell>
                    {notification.readAt ? formatDate(notification.readAt) : "Unread"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleOpenNotification(notification);
                      }}
                    >
                      {notification.readAt ? "Open" : "View"}
                    </Button>
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
