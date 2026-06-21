import type { ActivityDisplayStatus } from "@/lib/dashboard/activity-display";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  ActivityDisplayStatus,
  { bg: string; text: string }
> = {
  Delivered: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  "In Transit": { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]" },
  Pending: { bg: "bg-[#FFEDD5]", text: "text-[#C2410C]" },
  Canceled: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]" },
};

type StatusBadgeProps = {
  status: ActivityDisplayStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        styles.bg,
        styles.text,
        className,
      )}
    >
      {status}
    </span>
  );
}
