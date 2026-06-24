"use client";

import { DailyReportStatusBadge } from "@/components/daily-report/daily-report-status-badge";
import { formatCurrency } from "@/lib/utils/format-currency";

type LiveActivityRow = {
  id: string;
  time: string;
  dispatcher: string;
  team: string;
  carrier: string;
  status: string;
  loadAmount: number | null;
  origin: string | null;
  destination: string | null;
};

type LiveActivityTableProps = {
  rows: LiveActivityRow[];
};

export function LiveActivityTable({ rows }: LiveActivityTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#E5E7EB] px-5 py-4">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Live Activity
        </h3>
        <p className="mt-1 text-sm text-[#64748B]">
          Latest activity entries for the selected date and filters
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-medium text-[#475569]">
            <tr>
              {[
                "Time",
                "Dispatcher",
                "Team",
                "Carrier",
                "Status",
                "Load Amount",
                "Origin",
                "Destination",
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
                  colSpan={8}
                  className="h-24 px-5 text-center text-sm text-[#64748B]"
                >
                  No activity records for this date and filter selection
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#E5E7EB] last:border-b-0"
                >
                  <td className="h-14 px-5 text-[#475569]">{row.time}</td>
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {row.dispatcher}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">{row.team}</td>
                  <td className="h-14 px-5 text-[#475569]">{row.carrier}</td>
                  <td className="h-14 px-5">
                    <DailyReportStatusBadge status={row.status} />
                  </td>
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {formatCurrency(row.loadAmount, { nullLabel: "—" })}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">
                    {row.origin ?? "—"}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">
                    {row.destination ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
