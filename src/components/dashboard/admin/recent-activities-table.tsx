import Link from "next/link";

import { MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/admin/status-badge";
import type { ActivityDisplayStatus } from "@/lib/dashboard/activity-display";
import { formatCurrency } from "@/lib/utils/format-currency";

type RecentActivityRow = {
  id: string;
  dateTime: string;
  dispatcher: string;
  initials: string;
  carrier: string;
  loadId: string;
  route: string;
  truckType: string;
  status: string;
  amount: number;
};

type RecentActivitiesTableProps = {
  rows: RecentActivityRow[];
};

export function RecentActivitiesTable({ rows }: RecentActivitiesTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Recent Daily Activities
        </h3>
        <Link
          href="/admin/activities"
          className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
        >
          View All Activities →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-medium text-[#475569]">
            <tr>
              {[
                "Date & Time",
                "Dispatcher",
                "Carrier",
                "Load ID",
                "Route",
                "Truck Type",
                "Status",
                "Load Amount",
                "Actions",
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
                  No recent activities found
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#E5E7EB] last:border-b-0"
                >
                  <td className="h-14 px-5 text-[#475569]">{row.dateTime}</td>
                  <td className="h-14 px-5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-[#F1F5F9] text-xs font-semibold text-[#475569]">
                        {row.initials}
                      </span>
                      <span className="font-medium text-[#0F172A]">
                        {row.dispatcher}
                      </span>
                    </div>
                  </td>
                  <td className="h-14 px-5 text-[#475569]">{row.carrier}</td>
                  <td className="h-14 px-5 font-medium text-[#2563EB]">
                    {row.loadId}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">{row.route}</td>
                  <td className="h-14 px-5 text-[#475569]">{row.truckType}</td>
                  <td className="h-14 px-5">
                    <StatusBadge status={row.status as ActivityDisplayStatus} />
                  </td>
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {formatCurrency(row.amount, { nullLabel: "—" })}
                  </td>
                  <td className="h-14 px-5">
                    <button
                      type="button"
                      className="rounded-md p-1 text-[#64748B] hover:bg-[#F1F5F9]"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
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
