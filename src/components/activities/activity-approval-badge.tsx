"use client";

import { ACTIVITY_APPROVAL_LABELS } from "@/lib/constants/activity-approval";
import type { ActivityApprovalStatus } from "@/lib/constants/activity-approval";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const APPROVAL_BADGE_CLASSES: Record<ActivityApprovalStatus, string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PENDING_TEAM_LEAD_APPROVAL: "border-amber-200 bg-amber-50 text-amber-900",
  PENDING_ADMIN_APPROVAL: "border-orange-200 bg-orange-50 text-orange-900",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
};

type ActivityApprovalBadgeProps = {
  approvalStatus: ActivityApprovalStatus;
  className?: string;
};

export function ActivityApprovalBadge({
  approvalStatus,
  className,
}: ActivityApprovalBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(APPROVAL_BADGE_CLASSES[approvalStatus], className)}
    >
      {ACTIVITY_APPROVAL_LABELS[approvalStatus]}
    </Badge>
  );
}
