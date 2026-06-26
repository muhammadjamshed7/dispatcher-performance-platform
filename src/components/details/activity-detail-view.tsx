import type { ComponentType, ReactNode } from "react";
import {
  ClipboardList,
  Clock,
  GitCompareArrows,
  NotebookPen,
  TriangleAlert,
  Truck,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
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
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import { formatNullableText } from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type ActivityDetailViewProps = {
  activity: DailyActivity;
  editRequest?: ActivityEditRequestDto | null;
};

const DATETIME_PATTERN = "MMM d, yyyy 'at' h:mm a";

type DetailRow = {
  label: string;
  value: ReactNode;
};

function approverRoleLabel(role: Role | null | undefined): string | null {
  if (role === ADMIN) {
    return "Admin";
  }
  if (role === TEAM_LEAD) {
    return "Team Lead";
  }
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
    <section
      className={`bg-background overflow-hidden rounded-lg border ${className ?? ""}`}
    >
      <div className="bg-muted/20 border-b px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-blue-600" />
          {title}
        </h3>
      </div>
      <div className="px-5 py-2">{children}</div>
    </section>
  );
}

function DetailTable({ rows }: { rows: DetailRow[] }) {
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

export function ActivityDetailView({
  activity,
  editRequest,
}: ActivityDetailViewProps) {
  const approverRole = approverRoleLabel(activity.approvedByRole);
  const lastUpdated = resolveLastUpdated(activity);
  const isEdit = activity.approvalType === EDIT_ACTIVITY;
  const changeRows = editRequest
    ? buildActivityChangeRows(
        editRequest.previousData,
        editRequest.proposedChanges,
      )
    : [];

  const summaryRows: DetailRow[] = [
    { label: "Activity Date", value: activity.date },
    {
      label: "Submitted On",
      value: formatDate(activity.submittedAt, DATETIME_PATTERN, "—"),
    },
    {
      label: "Activity Type",
      value: <Badge variant="outline">{isEdit ? "Edit" : "New"}</Badge>,
    },
    { label: "Carrier", value: activity.carrierName },
    {
      label: "Driver",
      value: formatNullableText(activity.driverName, "—"),
    },
    { label: "Dispatcher", value: activity.dispatcherName },
    { label: "Team", value: activity.teamName },
    {
      label: "Truck Type",
      value: activity.truckType.replaceAll("_", " "),
    },
    {
      label: "Load Status",
      value: <StatusBadge status={activity.status} />,
    },
    {
      label: "Approval Status",
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <ActivityApprovalBadge approvalStatus={activity.approvalStatus} />
          {activity.hasPendingEdit ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-900"
            >
              Edit pending review
            </Badge>
          ) : null}
        </span>
      ),
    },
  ];

  if (activity.approvalStatus === APPROVED && approverRole) {
    summaryRows.push({
      label: "Approved By",
      value: `${approverRole}${
        activity.approvedByName ? ` · ${activity.approvedByName}` : ""
      }`,
    });
  }

  const loadRows: DetailRow[] = [
    {
      label: "Origin (Pickup)",
      value: formatNullableText(activity.origin, "N/A"),
    },
    {
      label: "Destination (Drop-off)",
      value: formatNullableText(activity.destination, "N/A"),
    },
    {
      label: "Total Miles",
      value: activity.miles ?? "N/A",
    },
    {
      label: "Load Amount",
      value: formatCurrency(activity.loadAmount, { nullLabel: "N/A" }),
    },
    {
      label: "Rate Per Mile",
      value: formatRatePerMile(activity.ratePerMile, "N/A"),
    },
    {
      label: "Dispatch Fee Earned",
      value: formatCurrency(activity.dispatchFee, { nullLabel: "N/A" }),
    },
  ];

  const timelineRows: DetailRow[] = [
    {
      label: "Created",
      value: formatDate(activity.submittedAt, DATETIME_PATTERN, "—"),
    },
    {
      label: "Last Updated",
      value: formatDate(lastUpdated, DATETIME_PATTERN, "—"),
    },
  ];

  if (activity.teamLeadApprovedAt) {
    timelineRows.push({
      label: "Team Lead Approved",
      value: formatDate(activity.teamLeadApprovedAt, DATETIME_PATTERN, "—"),
    });
  }

  if (activity.adminApprovedAt) {
    timelineRows.push({
      label: "Admin Approved",
      value: formatDate(activity.adminApprovedAt, DATETIME_PATTERN, "—"),
    });
  }

  if (activity.rejectedAt) {
    timelineRows.push({
      label: "Rejected",
      value: formatDate(activity.rejectedAt, DATETIME_PATTERN, "—"),
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <SectionCard icon={ClipboardList} title="Basic Activity Information">
            <DetailTable rows={summaryRows} />
          </SectionCard>

          <SectionCard icon={NotebookPen} title="Notes & Reason">
            <DetailTable
              rows={[
                {
                  label: "Reason",
                  value: (
                    <span className="whitespace-pre-wrap">
                      {formatNullableText(activity.reason, "N/A")}
                    </span>
                  ),
                },
                {
                  label: "Notes",
                  value: (
                    <span className="whitespace-pre-wrap">
                      {formatNullableText(activity.notes, "N/A")}
                    </span>
                  ),
                },
              ]}
            />
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard icon={Truck} title="Load & Work Details">
            <DetailTable rows={loadRows} />
          </SectionCard>

          <SectionCard icon={Clock} title="Approval Timeline">
            <DetailTable rows={timelineRows} />
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

      {activity.approvalStatus === REJECTED && activity.rejectionReason ? (
        <SectionCard
          icon={TriangleAlert}
          title="Rejection Feedback"
          className="border-red-200"
        >
          <p className="text-sm whitespace-pre-wrap text-red-900">
            {activity.rejectionReason}
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
