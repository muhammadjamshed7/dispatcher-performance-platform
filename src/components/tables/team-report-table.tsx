import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamReportRow } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { formatPercent } from "@/lib/utils/format-percent";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type TeamReportTableProps = {
  rows : TeamReportRow[];
  title?: string;
};

export function TeamReportTable({
  rows,
  title = "Team Report",
}: TeamReportTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Team Lead</TableHead>
              <TableHead>Dispatchers</TableHead>
              <TableHead>Active Carriers</TableHead>
              <TableHead>Delivered Loads</TableHead>
              <TableHead>Cancelled Loads</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Dispatch Fees</TableHead>
              <TableHead>Average Rate Per Mile</TableHead>
              <TableHead>Cancellation Rate</TableHead>
              <TableHead>Team Rank</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.teamName}</TableCell>
                <TableCell>{row.teamLeadName}</TableCell>
                <TableCell>{row.dispatchers}</TableCell>
                <TableCell>{row.activeCarriers}</TableCell>
                <TableCell>{row.deliveredLoads}</TableCell>
                <TableCell>{row.cancelledLoads}</TableCell>
                <TableCell>{formatCurrencyCompact(row.revenue)}</TableCell>
                <TableCell>{formatCurrencyCompact(row.dispatchFees)}</TableCell>
                <TableCell>{formatRatePerMile(row.averageRatePerMile)}</TableCell>
                <TableCell>{formatPercent(row.cancellationRate)}</TableCell>
                <TableCell>{row.teamRank}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
