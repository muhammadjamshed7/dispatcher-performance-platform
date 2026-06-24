"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinanceCarrierRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type FinanceCarrierTableProps = {
  rows: FinanceCarrierRow[];
};

export function FinanceCarrierTable({ rows }: FinanceCarrierTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carrier-wise Finance</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Carrier Name</TableHead>
              <TableHead>Driver Name</TableHead>
              <TableHead>Truck Type</TableHead>
              <TableHead>Delivered Loads</TableHead>
              <TableHead>Total Load Amount</TableHead>
              <TableHead>Dispatch Fee Earned</TableHead>
              <TableHead>Average Rate Per Mile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center"
                >
                  No carrier finance data found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.carrierName}
                  </TableCell>
                  <TableCell>{row.driverName}</TableCell>
                  <TableCell>{row.truckType.replaceAll("_", " ")}</TableCell>
                  <TableCell>{row.deliveredLoads}</TableCell>
                  <TableCell>{formatCurrency(row.totalLoadAmount)}</TableCell>
                  <TableCell>{formatCurrency(row.dispatchFeeEarned)}</TableCell>
                  <TableCell>
                    {formatRatePerMile(row.averageRatePerMile)}
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
