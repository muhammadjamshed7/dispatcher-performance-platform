import Link from "next/link";

import { ChevronDown } from "lucide-react";

import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type TopPerformer = {
  rank: number;
  name: string;
  initials: string;
  team: string;
  revenue: number;
};

type TopPerformersCardProps = {
  performers: TopPerformer[];
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPerformersCard({ performers }: TopPerformersCardProps) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] xl:col-span-1">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#0F172A]">Top Performers</h3>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569]"
        >
          This Week
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div className="space-y-4">
        {performers.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#64748B]">No data available</p>
        ) : (
          performers.map((performer) => (
            <div key={performer.name} className="flex items-center gap-3">
            <span className="w-6 text-center text-lg">
              {MEDALS[performer.rank - 1] ?? performer.rank}
            </span>
            <div className="flex size-10 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-semibold text-[#1D4ED8]">
              {performer.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#0F172A]">
                {performer.name}
              </p>
              <p className="truncate text-xs text-[#64748B]">{performer.team}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#0F172A]">
                {formatCurrencyCompact(performer.revenue)}
              </p>
              <p className="text-[11px] text-[#64748B]">Revenue</p>
            </div>
          </div>
          ))
        )}
      </div>
      <Link
        href="/admin/rankings"
        className="mt-5 inline-flex text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
      >
        View all rankings →
      </Link>
    </div>
  );
}
