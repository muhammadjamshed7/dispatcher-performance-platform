"use client";

import { MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatActivityDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatNullableNumber, formatNullableText } from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export type ActivityRowAction = "view" | "edit";

type ActivitiesTableProps = {
  activities: DailyActivity[];
  onAction: (activity: DailyActivity, action: ActivityRowAction) => void;
};

export function ActivitiesTable({ activities, onAction }: ActivitiesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Activities</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Dispatcher</TableHead>
              <TableHead>Team</TableHead>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={15}
                  className="py-8 text-center text-muted-foreground"
                >
                  No activities found.
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{formatActivityDate(activity.date)}</TableCell>
                  <TableCell className="font-medium">
                    {activity.carrierName}
                  </TableCell>
                  <TableCell>{activity.dispatcherName}</TableCell>
                  <TableCell>{activity.teamName}</TableCell>
                  <TableCell>{activity.truckType.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <StatusBadge status={activity.status} />
                  </TableCell>
                  <TableCell>{formatNullableText(activity.origin, "—")}</TableCell>
                  <TableCell>
                    {formatNullableText(activity.destination, "—")}
                  </TableCell>
                  <TableCell>{formatNullableNumber(activity.miles, "—")}</TableCell>
                  <TableCell>
                    {formatCurrency(activity.loadAmount, { nullLabel: "—" })}
                  </TableCell>
                  <TableCell>
                    {activity.status === DELIVERED
                      ? formatRatePerMile(activity.ratePerMile, "—")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {activity.status === DELIVERED
                      ? formatCurrency(activity.dispatchFee, { nullLabel: "—" })
                      : "—"}
                  </TableCell>
                  <TableCell>{formatNullableText(activity.reason, "—")}</TableCell>
                  <TableCell>{formatNullableText(activity.notes, "—")}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${activity.carrierName}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onAction(activity, "view")}
                        >
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onAction(activity, "edit")}
                        >
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
