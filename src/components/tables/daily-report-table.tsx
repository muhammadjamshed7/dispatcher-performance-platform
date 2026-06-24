import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DELIVERED } from "@/lib/constants/statuses";
import type { DailyActivity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import {
  formatNullableNumber,
  formatNullableText,
} from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type DailyReportTableProps = {
  rows: DailyActivity[];
  title?: string;
};

export function DailyReportTable({
  rows,
  title = "Daily Report",
}: DailyReportTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Dispatcher</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Truck Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Miles</TableHead>
              <TableHead>Load Amount</TableHead>
              <TableHead>Rate Per Mile</TableHead>
              <TableHead>Dispatch Fee</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="text-muted-foreground py-8 text-center"
                >
                  No report rows found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.dispatcherName}</TableCell>
                  <TableCell>{row.teamName}</TableCell>
                  <TableCell className="font-medium">
                    {row.carrierName}
                  </TableCell>
                  <TableCell>{row.truckType.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{formatNullableText(row.origin)}</TableCell>
                  <TableCell>{formatNullableText(row.destination)}</TableCell>
                  <TableCell>{formatNullableNumber(row.miles)}</TableCell>
                  <TableCell>{formatCurrency(row.loadAmount)}</TableCell>
                  <TableCell>
                    {row.status === DELIVERED
                      ? formatRatePerMile(row.ratePerMile)
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {row.status === DELIVERED
                      ? formatCurrency(row.dispatchFee)
                      : "N/A"}
                  </TableCell>
                  <TableCell>{formatNullableText(row.reason)}</TableCell>
                  <TableCell>{formatNullableText(row.notes)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
