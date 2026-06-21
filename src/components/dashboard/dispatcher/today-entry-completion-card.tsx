import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";

import type { DispatcherTodayCompletion } from "@/lib/types";
import { cn } from "@/lib/utils";

type TodayEntryCompletionCardProps = {
  completion: DispatcherTodayCompletion;
};

export function TodayEntryCompletionCard({
  completion,
}: TodayEntryCompletionCardProps) {
  const {
    assignedActive,
    loggedToday,
    pendingCount,
    completionPercent,
    isComplete,
    message,
  } = completion;

  const hasCarriers = assignedActive > 0;
  const actionHref = "/dispatcher/activities";
  const actionLabel = isComplete && hasCarriers
    ? "View today's activities"
    : "Log pending activities";

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                isComplete && hasCarriers
                  ? "bg-[#DCFCE7] text-[#15803D]"
                  : "bg-[#DBEAFE] text-[#2563EB]",
              )}
            >
              {isComplete && hasCarriers ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <ClipboardList className="size-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#0F172A]">
                Today&apos;s Entry Completion
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Logged today:{" "}
                <span className="font-semibold text-[#0F172A]">
                  {loggedToday} of {assignedActive}
                </span>{" "}
                assigned carriers
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Completion</span>
              <span className="font-semibold text-[#0F172A]">
                {hasCarriers ? `${completionPercent}%` : "0%"}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isComplete && hasCarriers ? "bg-[#22C55E]" : "bg-[#2563EB]",
                )}
                style={{
                  width: `${hasCarriers ? completionPercent : 0}%`,
                }}
              />
            </div>
            <p className="text-sm text-[#475569]">{message}</p>
          </div>

          <Link
            href={actionHref}
            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#2563EB] px-4 text-sm font-medium text-white hover:bg-[#1D4ED8]"
          >
            {actionLabel}
          </Link>
        </div>

        <div className="grid w-full shrink-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[420px]">
          {[
            {
              label: "Assigned Active Carriers",
              value: assignedActive.toLocaleString(),
              accent: "#2563EB",
              bg: "#DBEAFE",
            },
            {
              label: "Logged Today",
              value: loggedToday.toLocaleString(),
              accent: "#22C55E",
              bg: "#DCFCE7",
            },
            {
              label: "Pending Entries",
              value: pendingCount.toLocaleString(),
              accent: "#F97316",
              bg: "#FFEDD5",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4"
            >
              <p className="text-xs font-medium text-[#64748B]">{stat.label}</p>
              <p
                className="mt-2 text-2xl font-semibold"
                style={{ color: stat.accent }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
