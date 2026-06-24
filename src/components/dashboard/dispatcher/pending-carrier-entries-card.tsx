import Link from "next/link";

import type { DispatcherPendingCarrier } from "@/lib/types";

type PendingCarrierEntriesCardProps = {
  carriers: DispatcherPendingCarrier[];
};

export function PendingCarrierEntriesCard({
  carriers,
}: PendingCarrierEntriesCardProps) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#E5E7EB] px-5 py-4">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Pending Carrier Entries
        </h3>
        <p className="mt-1 text-sm text-[#64748B]">
          Carriers that still need today&apos;s activity logged.
        </p>
      </div>

      {carriers.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[#64748B]">
          No pending carrier entries. You are fully logged for today.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs font-medium text-[#475569]">
              <tr>
                {[
                  "Carrier",
                  "Driver",
                  "Truck Type",
                  "Last Activity",
                  "Action",
                ].map((column) => (
                  <th key={column} className="px-5 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carriers.map((carrier) => (
                <tr
                  key={carrier.id}
                  className="border-b border-[#E5E7EB] last:border-b-0"
                >
                  <td className="h-14 px-5 font-medium text-[#0F172A]">
                    {carrier.carrierName}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">
                    {carrier.driverName}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">
                    {carrier.truckType}
                  </td>
                  <td className="h-14 px-5 text-[#475569]">
                    {carrier.lastActivityStatus && carrier.lastActivityDate
                      ? `${carrier.lastActivityStatus} · ${carrier.lastActivityDate}`
                      : "No prior activity"}
                  </td>
                  <td className="h-14 px-5">
                    <Link
                      href="/dispatcher/activities"
                      className="inline-flex h-9 items-center rounded-[10px] border border-[#2563EB] px-3 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF]"
                    >
                      Log Activity
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
