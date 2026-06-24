import { SimpleDataTable } from "@/components/tables/simple-data-table";
import type {
  CarrierRanking,
  DispatcherRanking,
  TeamRanking,
} from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type RankingsTableProps =
  | { type: "dispatchers"; rows: DispatcherRanking[] }
  | { type: "carriers"; rows: CarrierRanking[] }
  | { type: "teams"; rows: TeamRanking[] };

export function RankingsTable(props: RankingsTableProps) {
  if (props.type === "dispatchers") {
    return (
      <SimpleDataTable
        title="Dispatcher Rankings"
        columns={["Rank", "Dispatcher", "Team", "Assigned Carriers"]}
        rows={props.rows.map((row) => [
          row.rank.toString(),
          row.name,
          row.team,
          row.carriers.toString(),
        ])}
        emptyMessage="No dispatcher rankings for the selected filters."
      />
    );
  }

  if (props.type === "carriers") {
    return (
      <SimpleDataTable
        title="Carrier Rankings"
        columns={["Rank", "Carrier", "Dispatcher", "Activity Score"]}
        rows={props.rows.map((row) => [
          row.rank.toString(),
          row.carrierName,
          row.dispatcherName,
          row.activityScore.toString(),
        ])}
        emptyMessage="No carrier rankings for the selected filters."
      />
    );
  }

  return (
    <SimpleDataTable
      title="Team Rankings"
      columns={["Rank", "Team", "Team Lead", "Revenue"]}
      rows={props.rows.map((row) => [
        row.rank.toString(),
        row.teamName,
        row.teamLeadName,
        formatCurrencyCompact(row.revenue),
      ])}
      emptyMessage="No team rankings for the selected filters."
    />
  );
}
