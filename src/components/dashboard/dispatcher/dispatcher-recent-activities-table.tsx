import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/admin/status-badge";
import type { ActivityDisplayStatus } from "@/lib/dashboard/activity-display";
import type { DispatcherRecentActivityRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type DispatcherRecentActivitiesTableProps = {
  rows: DispatcherRecentActivityRow[];
};

function formatDetailCell(row: DispatcherRecentActivityRow): {
  origin: string;
  destination: string;
  miles: string;
  amount: string;
  rate: string;
  reason: string;
} {
  const isDelivered = row.status === "Delivered";

  return {
    origin: isDelivered ? (row.origin ?? "—") : "—",
    destination: isDelivered ? (row.destination ?? "—") : "—",
    miles: isDelivered ? (row.miles?.toLocaleString() ?? "—") : "—",
    amount: isDelivered
      ? formatCurrency(row.loadAmount, { nullLabel: "—" })
      : "—",
    rate: isDelivered ? formatRatePerMile(row.ratePerMile, "—") : "—",
    reason: isDelivered ? "—" : (row.reason ?? "—"),
  };
}

export function DispatcherRecentActivitiesTable({
  rows,
}: DispatcherRecentActivitiesTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">
            Recent Daily Activities
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Your latest logged activities for the selected period.
          </p>
        </div>
        <Link
          href="/dispatcher/activities"
          className="shrink-0 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
        >
          View All Activities →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-medium text-[#475569]">
            <tr>
              {[
                "Date",
                "Carrier",
                "Status",
                "Origin",
                "Destination",
                "Miles",
                "Load Amount",
                "Rate / Mile",
                "Reason",
              ].map((column) => (
                <th key={column} className="px-5 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="h-24 px-5 text-center text-sm text-[#64748B]"
                >
                  No recent activities found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const detail = formatDetailCell(row);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[#E5E7EB] last:border-b-0"
                  >
                    <td className="h-14 px-5 text-[#475569]">{row.date}</td>
                    <td className="h-14 px-5 font-medium text-[#0F172A]">
                      {row.carrierName}
                    </td>
                    <td className="h-14 px-5">
                      <StatusBadge
                        status={row.status as ActivityDisplayStatus}
                      />
                    </td>
                    <td className="h-14 px-5 text-[#475569]">
                      {detail.origin}
                    </td>
                    <td className="h-14 px-5 text-[#475569]">
                      {detail.destination}
                    </td>
                    <td className="h-14 px-5 text-[#475569]">{detail.miles}</td>
                    <td className="h-14 px-5 font-medium text-[#0F172A]">
                      {detail.amount}
                    </td>
                    <td className="h-14 px-5 text-[#475569]">{detail.rate}</td>
                    <td className="h-14 max-w-[200px] truncate px-5 text-[#475569]">
                      {detail.reason}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
