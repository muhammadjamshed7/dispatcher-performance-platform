import { StatusBadge } from "@/components/dashboard/admin/status-badge";
import type { ActivityDisplayStatus } from "@/lib/dashboard/activity-display";
import type { DispatcherCarrierPerformanceRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

type AssignedCarrierPerformanceTableProps = {
  rows: DispatcherCarrierPerformanceRow[];
};

function CarrierStatusPill({ status }: { status: string }) {
  const isActive = status === "Active";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        isActive
          ? "bg-[#DCFCE7] text-[#15803D]"
          : "bg-[#F1F5F9] text-[#64748B]",
      )}
    >
      {status}
    </span>
  );
}

export function AssignedCarrierPerformanceTable({
  rows,
}: AssignedCarrierPerformanceTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#E5E7EB] px-5 py-4">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Assigned Carrier Performance
        </h3>
        <p className="mt-1 text-sm text-[#64748B]">
          Month-to-date performance for your assigned carriers.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-medium text-[#475569]">
            <tr>
              {[
                "Carrier",
                "Driver",
                "Truck Type",
                "Recent Status",
                "Last Activity",
                "Loads MTD",
                "Revenue MTD",
                "Status",
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
                  No assigned carriers found. Contact your Team Lead or Admin to assign
                  carriers.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.carrierId}
                  className="border-b border-[#E5E7EB] last:border-b-0"
                >
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {row.carrierName}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">{row.driverName}</td>
                  <td className="h-14 px-5 text-[#475569]">{row.truckType}</td>
                  <td className="h-14 px-5">
                    {row.recentStatus !== "—" ? (
                      <StatusBadge status={row.recentStatus as ActivityDisplayStatus} />
                    ) : (
                      <span className="text-[#64748B]">—</span>
                    )}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">
                    {row.lastActivityDate ?? "—"}
                  </td>
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {row.loadsMtd.toLocaleString()}
                  </td>
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {formatCurrency(row.revenueMtd, { nullLabel: "$0" })}
                  </td>
                  <td className="h-14 px-5">
                    <CarrierStatusPill status={row.carrierStatus} />
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
