"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/components/auth/session-provider";
import {
  fetchNotifications,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "@/lib/api/resources";
import { NOTIFICATION_STATUS_LABELS } from "@/lib/constants/notifications";
import { getNotificationsPathForRole } from "@/lib/auth/roles";
import { getNotificationHref } from "@/lib/notifications/notification-links";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";

export function NotificationsDropdown() {
  const router = useRouter();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const loadNotifications = useCallback(() => fetchNotifications(), []);
  const { data, reload } = useApiData(
    loadNotifications,
    [Boolean(session)],
    { enabled: Boolean(session) },
  );

  const realtimeTables = useMemo(
    () => ["Notification", "DailyActivity", "ActivityEditRequest"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, reload);

  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;
  const notificationsPath = session
    ? getNotificationsPathForRole(session.role)
    : "#";

  const handleOpenNotification = async (notification: (typeof notifications)[number]) => {
    if (!session) {
      return;
    }

    if (!notification.readAt) {
      await markNotificationReadRequest(notification.id);
      await reload();
    }

    setOpen(false);
    router.push(getNotificationHref(session.role, notification));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadRequest();
    await reload();
  };

  if (!session) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative shrink-0 rounded-lg p-2 text-[#475569] hover:bg-[#F1F5F9]"
            aria-label="Notifications"
          />
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">
            No notifications yet.
          </div>
        ) : (
          notifications.slice(0, 8).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-pointer flex-col items-start gap-1 p-3"
              onClick={() => {
                void handleOpenNotification(notification);
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    !notification.readAt && "text-[#0F172A]",
                  )}
                >
                  {notification.title}
                </span>
                <span className="text-muted-foreground text-xs">
                  {NOTIFICATION_STATUS_LABELS[notification.notificationStatus]}
                </span>
              </div>
              <p className="text-muted-foreground line-clamp-2 text-xs">
                {notification.message}
              </p>
              <span className="text-muted-foreground text-[11px]">
                {formatDate(notification.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-center"
          onClick={() => {
            setOpen(false);
            router.push(notificationsPath);
          }}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
