import { SimpleDataTable } from "@/components/tables/simple-data-table";
import type { DailyActivity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";

type TeamActivityOverviewTableProps = {
  activities: DailyActivity[];
  limit?: number;
};

export function TeamActivityOverviewTable({
  activities,
  limit = 5,
}: TeamActivityOverviewTableProps) {
  return (
    <SimpleDataTable
      title="Team Activity Overview"
      columns={["Dispatcher", "Carrier", "Status", "Load Amount"]}
      rows={activities.slice(0, limit).map((activity) => [
        activity.dispatcherName,
        activity.carrierName,
        activity.status.replaceAll("_", " "),
        formatCurrency(activity.loadAmount, { nullLabel: "—" }),
      ])}
      emptyMessage="No team activities recorded yet."
    />
  );
}
