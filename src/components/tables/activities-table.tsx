"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Filter, MoreHorizontal, Search } from "lucide-react";

import { ActivityApprovalBadge } from "@/components/activities/activity-approval-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  APPROVED,
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
  REJECTED,
} from "@/lib/constants/activity-approval";
import { FILTER_ALL } from "@/lib/constants/filters";
import { ADMIN } from "@/lib/constants/roles";
import { CANCELLED, DELIVERED, NOT_BOOKED } from "@/lib/constants/statuses";
import type { DailyActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatActivityDate, formatDate } from "@/lib/utils/format-date";
import {
  formatNullableNumber,
  formatNullableText,
} from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export type ActivityRowAction = "view" | "edit";

type ActivitiesTableVariant = "default" | "dashboard";

type ActivitiesTableProps = {
  activities: DailyActivity[];
  onAction: (activity: DailyActivity, action: ActivityRowAction) => void;
  showApprovalStatus?: boolean;
  variant?: ActivitiesTableVariant;
};

type ApprovalFilterValue =
  | typeof FILTER_ALL
  | "APPROVED"
  | "PENDING"
  | "REJECTED";

const DASHBOARD_STATUS_OPTIONS = [
  { value: FILTER_ALL, label: "All Statuses" },
  { value: DELIVERED, label: "Delivered" },
  { value: CANCELLED, label: "Cancelled" },
  { value: NOT_BOOKED, label: "Not Booked" },
  { value: "BOOKED", label: "Booked" },
  { value: "IN_TRANSIT", label: "In Transit" },
] as const;

const DASHBOARD_APPROVAL_OPTIONS = [
  { value: FILTER_ALL, label: "All Approvals" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
] as const;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  [DELIVERED]: {
    label: "Delivered",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  [CANCELLED]: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  [NOT_BOOKED]: {
    label: "Not Booked",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  BOOKED: {
    label: "Booked",
    className: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  IN_TRANSIT: {
    label: "In Transit",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
};

const APPROVAL_STYLES: Record<
  "APPROVED" | "PENDING" | "REJECTED",
  { label: string; className: string }
> = {
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  PENDING: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

export function ActivitiesTable({
  activities,
  onAction,
  showApprovalStatus = true,
  variant = "default",
}: ActivitiesTableProps) {
  if (variant === "dashboard") {
    return (
      <DashboardActivitiesTable activities={activities} onAction={onAction} />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Activities</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Dispatcher</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Truck Type</TableHead>
              <TableHead>Status</TableHead>
              {showApprovalStatus ? <TableHead>Approval</TableHead> : null}
              {showApprovalStatus ? (
                <TableHead>Rejection Reason</TableHead>
              ) : null}
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Miles</TableHead>
              <TableHead>Load Amount</TableHead>
              <TableHead>Rate Per Mile</TableHead>
              <TableHead>Dispatch Fee</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showApprovalStatus ? 18 : 16}
                  className="text-muted-foreground py-8 text-center"
                >
                  No activities found.
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <DefaultActivityRow
                  key={activity.id}
                  activity={activity}
                  onAction={onAction}
                  showApprovalStatus={showApprovalStatus}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DefaultActivityRow({
  activity,
  onAction,
  showApprovalStatus,
}: {
  activity: DailyActivity;
  onAction: (activity: DailyActivity, action: ActivityRowAction) => void;
  showApprovalStatus: boolean;
}) {
  return (
    <TableRow>
      <TableCell>{formatActivityDate(activity.date)}</TableCell>
      <TableCell>
        <NameButton onClick={() => onAction(activity, "view")}>
          {activity.carrierName}
        </NameButton>
      </TableCell>
      <TableCell>
        {formatDate(activity.submittedAt, "MMM d, h:mm a", "-")}
      </TableCell>
      <TableCell>{activity.dispatcherName}</TableCell>
      <TableCell>{activity.teamName}</TableCell>
      <TableCell>{formatTruckType(activity.truckType)}</TableCell>
      <TableCell>
        <StatusBadge status={activity.status} />
      </TableCell>
      {showApprovalStatus ? (
        <TableCell>
          <div className="flex flex-col gap-1">
            <ActivityApprovalBadge
              approvalStatus={
                activity.pendingEditApprovalStatus ?? activity.approvalStatus
              }
            />
            {!activity.pendingEditApprovalStatus &&
            activity.approvalStatus === APPROVED &&
            activity.approvedByRole ? (
              <span className="text-muted-foreground text-[11px]">
                by {activity.approvedByRole === ADMIN ? "Admin" : "Team Lead"}
                {activity.approvedByName ? ` - ${activity.approvedByName}` : ""}
              </span>
            ) : null}
          </div>
        </TableCell>
      ) : null}
      {showApprovalStatus ? (
        <TableCell>
          {activity.approvalStatus === REJECTED
            ? formatNullableText(activity.rejectionReason, "-")
            : "-"}
        </TableCell>
      ) : null}
      <TableCell>{formatNullableText(activity.origin, "-")}</TableCell>
      <TableCell>{formatNullableText(activity.destination, "-")}</TableCell>
      <TableCell>{formatNullableNumber(activity.miles, "-")}</TableCell>
      <TableCell>
        {formatCurrency(activity.loadAmount, { nullLabel: "-" })}
      </TableCell>
      <TableCell>
        {activity.status === DELIVERED
          ? formatRatePerMile(activity.ratePerMile, "-")
          : "-"}
      </TableCell>
      <TableCell>
        {activity.status === DELIVERED
          ? formatCurrency(activity.dispatchFee, { nullLabel: "-" })
          : "-"}
      </TableCell>
      <TableCell>{formatNullableText(activity.reason, "-")}</TableCell>
      <TableCell>{formatNullableText(activity.notes, "-")}</TableCell>
      <TableCell className="text-right">
        <ActivityActions activity={activity} onAction={onAction} />
      </TableCell>
    </TableRow>
  );
}

function DashboardActivitiesTable({
  activities,
  onAction,
}: {
  activities: DailyActivity[];
  onAction: (activity: DailyActivity, action: ActivityRowAction) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(FILTER_ALL);
  const [approval, setApproval] = useState<ApprovalFilterValue>(FILTER_ALL);
  const [date, setDate] = useState("");

  const filteredActivities = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return activities.filter((activity) => {
      if (date && getActivityDateKey(activity.date) !== date) return false;
      if (status !== FILTER_ALL && activity.status !== status) return false;
      if (approval !== FILTER_ALL && getApprovalGroup(activity) !== approval) {
        return false;
      }
      if (!normalizedSearch) return true;

      return [
        activity.carrierName,
        activity.driverName,
        activity.dispatcherName,
        activity.teamName,
        activity.origin,
        activity.destination,
        activity.reason,
        activity.notes,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    });
  }, [activities, approval, date, search, status]);

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 border-b border-[#E2E8F0] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">
            Daily Activities
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Review filtered activity, approvals, routes, and load values.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center">
          <div className="relative sm:col-span-2 lg:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities..."
              className="h-9 rounded-xl border-[#DDE5F0] bg-white pl-8 text-sm"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value ?? FILTER_ALL)}
          >
            <SelectTrigger className="h-9 w-full rounded-xl border-[#DDE5F0] bg-white lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {DASHBOARD_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={approval}
            onValueChange={(value) =>
              setApproval((value ?? FILTER_ALL) as ApprovalFilterValue)
            }
          >
            <SelectTrigger className="h-9 w-full rounded-xl border-[#DDE5F0] bg-white lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {DASHBOARD_APPROVAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 rounded-xl border-[#DDE5F0] bg-white text-sm lg:w-40"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="hidden rounded-xl border-[#DDE5F0] text-[#475569] lg:inline-flex"
            aria-label="Table filters"
          >
            <Filter className="size-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1320px]">
          <TableHeader>
            <TableRow className="border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F8FAFC]">
              <DashboardHead>Date</DashboardHead>
              <DashboardHead>Carrier</DashboardHead>
              <DashboardHead>Submitted</DashboardHead>
              <DashboardHead>Dispatcher</DashboardHead>
              <DashboardHead>Team</DashboardHead>
              <DashboardHead>Truck Type</DashboardHead>
              <DashboardHead>Status</DashboardHead>
              <DashboardHead>Approval</DashboardHead>
              <DashboardHead>Rejection Reason</DashboardHead>
              <DashboardHead>Origin</DashboardHead>
              <DashboardHead>Destination</DashboardHead>
              <DashboardHead>Miles</DashboardHead>
              <DashboardHead>Load Amount</DashboardHead>
              <DashboardHead className="text-right">Actions</DashboardHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActivities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="h-28 text-center text-sm text-[#64748B]"
                >
                  No activities match the selected table filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredActivities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className="border-[#E2E8F0] hover:bg-[#F8FAFC]"
                >
                  <DashboardCell>
                    {formatActivityDate(activity.date)}
                  </DashboardCell>
                  <DashboardCell>
                    <NameButton onClick={() => onAction(activity, "view")}>
                      {activity.carrierName}
                    </NameButton>
                  </DashboardCell>
                  <DashboardCell>
                    {formatDate(activity.submittedAt, "MMM d, h:mm a", "-")}
                  </DashboardCell>
                  <DashboardCell>{activity.dispatcherName}</DashboardCell>
                  <DashboardCell>{activity.teamName}</DashboardCell>
                  <DashboardCell>
                    {formatTruckType(activity.truckType)}
                  </DashboardCell>
                  <DashboardCell>
                    <DashboardStatusBadge status={activity.status} />
                  </DashboardCell>
                  <DashboardCell>
                    <DashboardApprovalBadge activity={activity} />
                  </DashboardCell>
                  <DashboardCell>
                    {activity.approvalStatus === REJECTED
                      ? formatNullableText(activity.rejectionReason, "-")
                      : "-"}
                  </DashboardCell>
                  <DashboardCell>
                    {formatNullableText(activity.origin, "-")}
                  </DashboardCell>
                  <DashboardCell>
                    {formatNullableText(activity.destination, "-")}
                  </DashboardCell>
                  <DashboardCell>
                    {formatNullableNumber(activity.miles, "-")}
                  </DashboardCell>
                  <DashboardCell>
                    {formatCurrency(activity.loadAmount, {
                      currency: "USD",
                      nullLabel: "-",
                    })}
                  </DashboardCell>
                  <DashboardCell className="text-right">
                    <ActivityActions activity={activity} onAction={onAction} />
                  </DashboardCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#E2E8F0] px-5 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {filteredActivities.length.toLocaleString()} of{" "}
          {activities.length.toLocaleString()} activities
        </span>
        <span>All dashboard totals follow the global filters above.</span>
      </div>
    </section>
  );
}

function ActivityActions({
  activity,
  onAction,
}: {
  activity: DailyActivity;
  onAction: (activity: DailyActivity, action: ActivityRowAction) => void;
}) {
  return (
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
        <DropdownMenuItem onClick={() => onAction(activity, "view")}>
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction(activity, "edit")}>
          Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NameButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="cursor-pointer text-left font-semibold text-[#0F172A] underline-offset-4 hover:text-[#2563EB] hover:underline focus-visible:text-[#2563EB] focus-visible:underline focus-visible:outline-none"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DashboardHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        "h-11 px-4 text-xs font-semibold tracking-[0.02em] whitespace-nowrap text-[#64748B] uppercase",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

function DashboardCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableCell
      className={cn(
        "px-4 py-3 text-sm whitespace-nowrap text-[#334155]",
        className,
      )}
    >
      {children}
    </TableCell>
  );
}

function DashboardStatusBadge({ status }: { status: string }) {
  const meta = STATUS_STYLES[status] ?? {
    label: status.replaceAll("_", " "),
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return <Pill className={meta.className}>{meta.label}</Pill>;
}

function DashboardApprovalBadge({ activity }: { activity: DailyActivity }) {
  const group = getApprovalGroup(activity);
  const meta = APPROVAL_STYLES[group];

  return <Pill className={meta.className}>{meta.label}</Pill>;
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold uppercase ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

function getApprovalGroup(
  activity: DailyActivity,
): "APPROVED" | "PENDING" | "REJECTED" {
  const status = activity.pendingEditApprovalStatus ?? activity.approvalStatus;
  if (status === APPROVED) return "APPROVED";
  if (status === REJECTED) return "REJECTED";
  if (
    status === PENDING_ADMIN_APPROVAL ||
    status === PENDING_TEAM_LEAD_APPROVAL
  ) {
    return "PENDING";
  }
  return "PENDING";
}

function formatTruckType(truckType: string) {
  return truckType.replaceAll("_", " ");
}

function getActivityDateKey(date: string) {
  return date.slice(0, 10);
}
