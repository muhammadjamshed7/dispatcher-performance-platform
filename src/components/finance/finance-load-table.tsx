"use client";

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
import type { FinanceLoadRow } from "@/lib/types";
import { formatActivityDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";
import {
  formatNullableNumber,
  formatNullableText,
} from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type FinanceLoadTableProps = {
  rows: FinanceLoadRow[];
};

export function FinanceLoadTable({ rows }: FinanceLoadTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Load-wise Finance History</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Miles</TableHead>
              <TableHead>Load Amount</TableHead>
              <TableHead>Rate Per Mile</TableHead>
              <TableHead>Dispatch Fee</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground py-8 text-center"
                >
                  No load finance history found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatActivityDate(row.date)}</TableCell>
                  <TableCell>{row.carrierName}</TableCell>
                  <TableCell>{formatNullableText(row.origin)}</TableCell>
                  <TableCell>{formatNullableText(row.destination)}</TableCell>
                  <TableCell>{formatNullableNumber(row.miles)}</TableCell>
                  <TableCell>
                    {formatCurrency(row.loadAmount, { nullLabel: "—" })}
                  </TableCell>
                  <TableCell>
                    {formatRatePerMile(row.ratePerMile, "—")}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(row.dispatchFee, { nullLabel: "—" })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
