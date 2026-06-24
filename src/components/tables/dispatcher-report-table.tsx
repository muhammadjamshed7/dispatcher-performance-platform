import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DispatcherReportRow } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { formatPercent } from "@/lib/utils/format-percent";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type DispatcherReportTableProps = {
  rows: DispatcherReportRow[];
  title?: string;
};

export function DispatcherReportTable({
  rows,
  title = "Dispatcher Report",
}: DispatcherReportTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dispatcher Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Delivered Loads</TableHead>
              <TableHead>Cancelled Loads</TableHead>
              <TableHead>Not Booked Count</TableHead>
              <TableHead>Not Working Count</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Dispatch Fees</TableHead>
              <TableHead>Average Rate Per Mile</TableHead>
              <TableHead>Cancellation Rate</TableHead>
              <TableHead>Booking Efficiency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.dispatcherName}
                </TableCell>
                <TableCell>{row.teamName}</TableCell>
                <TableCell>{row.deliveredLoads}</TableCell>
                <TableCell>{row.cancelledLoads}</TableCell>
                <TableCell>{row.notBookedCount}</TableCell>
                <TableCell>{row.notWorkingCount}</TableCell>
                <TableCell>{formatCurrencyCompact(row.revenue)}</TableCell>
                <TableCell>{formatCurrencyCompact(row.dispatchFees)}</TableCell>
                <TableCell>
                  {formatRatePerMile(row.averageRatePerMile)}
                </TableCell>
                <TableCell>{formatPercent(row.cancellationRate)}</TableCell>
                <TableCell>{formatPercent(row.bookingEfficiency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
