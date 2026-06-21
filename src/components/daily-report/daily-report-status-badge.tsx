"use client";

import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Delivered: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  Cancelled: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]" },
  "Not Booked": { bg: "bg-[#FFEDD5]", text: "text-[#C2410C]" },
  "Not Working": { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]" },
};

type DailyReportStatusBadgeProps = {
  status: string;
  className?: string;
};

export function DailyReportStatusBadge({
  status,
  className,
}: DailyReportStatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? {
    bg: "bg-[#F1F5F9]",
    text: "text-[#475569]",
  };

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
