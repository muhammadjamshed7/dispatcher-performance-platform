import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CarrierReportRow } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type CarrierReportTableProps = {
  rows : CarrierReportRow[];
  title?: string;
};

export function CarrierReportTable({
  rows,
  title = "Carrier Report",
}: CarrierReportTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Carrier Name</TableHead>
              <TableHead>Driver Name</TableHead>
              <TableHead>MC Number</TableHead>
              <TableHead>Dispatcher</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Truck Type</TableHead>
              <TableHead>Delivered Loads</TableHead>
              <TableHead>Cancelled Loads</TableHead>
              <TableHead>Not Booked Count</TableHead>
              <TableHead>Not Working Count</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Dispatch Fees</TableHead>
              <TableHead>Average Rate Per Mile</TableHead>
              <TableHead>Activity Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.carrierName}</TableCell>
                <TableCell>{row.driverName}</TableCell>
                <TableCell>{row.mcNumber}</TableCell>
                <TableCell>{row.dispatcherName}</TableCell>
                <TableCell>{row.teamName}</TableCell>
                <TableCell>{row.truckType.replaceAll("_", " ")}</TableCell>
                <TableCell>{row.deliveredLoads}</TableCell>
                <TableCell>{row.cancelledLoads}</TableCell>
                <TableCell>{row.notBookedCount}</TableCell>
                <TableCell>{row.notWorkingCount}</TableCell>
                <TableCell>{formatCurrencyCompact(row.revenue)}</TableCell>
                <TableCell>{formatCurrencyCompact(row.dispatchFees)}</TableCell>
                <TableCell>{formatRatePerMile(row.averageRatePerMile)}</TableCell>
                <TableCell>{row.activityScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
