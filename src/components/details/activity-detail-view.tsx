import type { ComponentType, ReactNode } from "react";
import {
  Calendar,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  GitCompareArrows,
  MapPin,
  NotebookPen,
  Receipt,
  Route,
  ShieldCheck,
  Tag,
  TrendingUp,
  TriangleAlert,
  Truck,
  User,
  Users,
} from "lucide-react";

import { ActivityApprovalBadge } from "@/components/activities/activity-approval-badge";
import {
  ActivityChangeComparison,
  buildActivityChangeRows,
} from "@/components/details/activity-change-comparison";
import {
  APPROVED,
  EDIT_ACTIVITY,
  REJECTED,
} from "@/lib/constants/activity-approval";
import { ADMIN, TEAM_LEAD, type Role } from "@/lib/constants/roles";
import { Badge } from "@/components/ui/badge";
import type { ActivityEditRequestDto, DailyActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import { formatNullableText } from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type ActivityDetailViewProps = {
  activity: DailyActivity;
  editRequest?: ActivityEditRequestDto | null;
};

const DATETIME_PATTERN = "MMM d, yyyy 'at' h:mm a";

const LOAD_STATUS_BADGE_CLASSES: Record<string, string> = {
  DELIVERED: "border-emerald-300 bg-emerald-100 text-emerald-800",
  NOT_BOOKED: "border-amber-300 bg-amber-100 text-amber-800",
  CANCELLED: "border-red-300 bg-red-100 text-red-700",
  NOT_WORKING: "border-slate-300 bg-slate-100 text-slate-700",
};

function approverRoleLabel(role: Role | null | undefined): string | null {
  if (role === ADMIN) return "Admin";
  if (role === TEAM_LEAD) return "Team Lead";
  return null;
}

function resolveLastUpdated(activity: DailyActivity): string | null {
  const candidates = [
    activity.rejectedAt,
    activity.adminApprovedAt,
    activity.teamLeadApprovedAt,
    activity.submittedAt,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return null;
  }

  return candidates
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .sort((a, b) => b.time - a.time)[0].value;
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card rounded-xl border shadow-sm", className)}>
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600">
          <Icon className="size-5" />
        </span>
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-blue-600" />
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-[13px] font-medium">{label}</p>
        <div className="text-foreground text-sm font-medium break-words">
          {value}
        </div>
      </div>
    </div>
  );
}

function ActivityTypeBadge({ isEdit }: { isEdit: boolean }) {
  return (
    <Badge
      variant="outline"
      className="border-blue-300 bg-blue-100 font-semibold text-blue-700"
    >
      {isEdit ? "Edit" : "New"}
    </Badge>
  );
}

function LoadStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        LOAD_STATUS_BADGE_CLASSES[status] ??
          "border-slate-300 bg-slate-100 text-slate-700",
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

type TimelineEvent = {
  title: string;
  date: string | null;
  tone: "green" | "blue" | "red";
};

const TIMELINE_DOT_CLASSES: Record<TimelineEvent["tone"], string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-600",
  red: "bg-red-500",
};

function ApprovalTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-6">
      {events.map((event, index) => (
        <li key={event.title} className="relative flex gap-3">
          <div className="relative flex flex-col items-center">
            <span
              className={cn(
                "z-10 mt-0.5 size-3.5 rounded-full",
                TIMELINE_DOT_CLASSES[event.tone],
              )}
            />
            {index < events.length - 1 ? (
              <span className="bg-border absolute top-3.5 left-1/2 h-[calc(100%+1.5rem)] w-px -translate-x-1/2" />
            ) : null}
          </div>
          <div className="-mt-0.5 min-w-0 pb-1">
            <p className="text-foreground text-sm font-semibold">
              {event.title}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatDate(event.date, DATETIME_PATTERN, "—")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground text-right text-sm font-medium">
        {value}
      </dd>
    </div>
  );
}

export function ActivityDetailView({
  activity,
  editRequest,
}: ActivityDetailViewProps) {
  const approverRole = approverRoleLabel(activity.approvedByRole);
  const lastUpdated = resolveLastUpdated(activity);
  const isEdit = activity.approvalType === EDIT_ACTIVITY;
  const isRejected = activity.approvalStatus === REJECTED;

  const changeRows = editRequest
    ? buildActivityChangeRows(
        editRequest.previousData,
        editRequest.proposedChanges,
      )
    : [];

  const milesValue =
    activity.miles != null ? activity.miles.toLocaleString("en-US") : "N/A";
  const loadAmountValue = formatCurrency(activity.loadAmount, {
    nullLabel: "N/A",
  });
  const dispatchFeeValue = formatCurrency(activity.dispatchFee, {
    nullLabel: "N/A",
  });

  const timelineEvents: TimelineEvent[] = [
    { title: "Created", date: activity.submittedAt, tone: "green" },
    { title: "Last Updated", date: lastUpdated, tone: "blue" },
  ];

  if (activity.rejectedAt) {
    timelineEvents.push({
      title: "Rejected",
      date: activity.rejectedAt,
      tone: "red",
    });
  } else if (activity.approvalStatus === APPROVED) {
    const approvedAt = activity.adminApprovedAt ?? activity.teamLeadApprovedAt;
    if (approvedAt) {
      timelineEvents.push({
        title: "Approved",
        date: approvedAt,
        tone: "green",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-6 min-[900px]:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        {/* Left column */}
        <div className="space-y-4">
          <SectionCard icon={ClipboardList} title="Basic Activity Information">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                icon={Calendar}
                label="Activity Date"
                value={activity.date}
              />
              <Field
                icon={Clock}
                label="Submitted On"
                value={formatDate(activity.submittedAt, DATETIME_PATTERN, "—")}
              />
              <Field
                icon={Tag}
                label="Activity Type"
                value={<ActivityTypeBadge isEdit={isEdit} />}
              />
              <Field
                icon={Truck}
                label="Carrier"
                value={activity.carrierName}
              />
              <Field
                icon={User}
                label="Driver"
                value={formatNullableText(activity.driverName, "—")}
              />
              <Field
                icon={User}
                label="Dispatcher"
                value={activity.dispatcherName}
              />
              <Field icon={Users} label="Team" value={activity.teamName} />
              <Field
                icon={Truck}
                label="Truck Type"
                value={activity.truckType.replaceAll("_", " ")}
              />
              <Field
                icon={ClipboardList}
                label="Load Status"
                value={<LoadStatusBadge status={activity.status} />}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t pt-4">
              <ShieldCheck className="size-4 shrink-0 text-blue-600" />
              <span className="text-muted-foreground text-[13px] font-medium">
                Approval Status
              </span>
              <ActivityApprovalBadge approvalStatus={activity.approvalStatus} />
              {activity.hasPendingEdit ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-100 text-amber-900"
                >
                  Edit pending review
                </Badge>
              ) : null}
              {activity.approvalStatus === APPROVED && approverRole ? (
                <span className="text-muted-foreground text-xs">
                  by {approverRole}
                  {activity.approvedByName
                    ? ` · ${activity.approvedByName}`
                    : ""}
                </span>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon={Truck} title="Load & Work Details">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                icon={MapPin}
                label="Origin (Pickup)"
                value={formatNullableText(activity.origin, "N/A")}
              />
              <Field
                icon={MapPin}
                label="Destination (Drop-off)"
                value={formatNullableText(activity.destination, "N/A")}
              />
              <Field icon={Route} label="Total Miles" value={milesValue} />
              <Field
                icon={DollarSign}
                label="Load Amount"
                value={loadAmountValue}
              />
              <Field
                icon={TrendingUp}
                label="Rate Per Mile"
                value={formatRatePerMile(activity.ratePerMile, "N/A")}
              />
              <Field
                icon={Receipt}
                label="Dispatch Fee Earned"
                value={dispatchFeeValue}
              />
            </div>
          </SectionCard>

          <SectionCard icon={NotebookPen} title="Notes & Reason">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[13px] font-medium">
                  Reason
                </p>
                <div className="bg-muted/40 text-foreground rounded-lg border p-3 text-sm break-words whitespace-pre-wrap">
                  {formatNullableText(activity.reason, "N/A")}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[13px] font-medium">
                  Notes
                </p>
                <div className="bg-muted/40 text-foreground rounded-lg border p-3 text-sm break-words whitespace-pre-wrap">
                  {formatNullableText(activity.notes, "N/A")}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <SectionCard icon={Clock} title="Approval Timeline">
            <ApprovalTimeline events={timelineEvents} />
          </SectionCard>

          <SectionCard icon={FileText} title="Quick Summary">
            <dl className="divide-y">
              <SummaryRow
                label="Activity Type"
                value={<ActivityTypeBadge isEdit={isEdit} />}
              />
              <SummaryRow
                label="Load Status"
                value={<LoadStatusBadge status={activity.status} />}
              />
              <SummaryRow
                label="Approval Status"
                value={
                  <ActivityApprovalBadge
                    approvalStatus={activity.approvalStatus}
                  />
                }
              />
              <SummaryRow label="Total Miles" value={milesValue} />
              <SummaryRow label="Load Amount" value={loadAmountValue} />
              <SummaryRow
                label="Dispatch Fee Earned"
                value={dispatchFeeValue}
              />
            </dl>
          </SectionCard>
        </div>
      </div>

      {changeRows.length > 0 ? (
        <SectionCard
          icon={GitCompareArrows}
          title="Edited Activity Comparison (Awaiting Approval)"
          className="border-amber-200"
        >
          {editRequest ? (
            <ActivityChangeComparison
              previousData={editRequest.previousData}
              proposedChanges={editRequest.proposedChanges}
            />
          ) : null}
        </SectionCard>
      ) : null}

      {isRejected && activity.rejectionReason ? (
        <section className="rounded-xl border border-red-300 bg-red-50 p-5">
          <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <TriangleAlert className="size-5 text-red-500" />
            Rejection Feedback
          </h3>
          <p className="mt-2 text-sm break-words whitespace-pre-wrap text-red-600">
            {activity.rejectionReason}
          </p>
        </section>
      ) : null}
    </div>
  );
}
