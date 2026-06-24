"use client";

import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import type { Carrier } from "@/lib/types";
import { formatDateShort } from "@/lib/utils/format-date";

export type CarrierRowAction = "view" | "edit" | "reassign" | "toggle-status";

type CarriersTableProps = {
  carriers: Carrier[];
  readOnly?: boolean;
  onAction: (carrier: Carrier, action: CarrierRowAction) => void;
};

export function CarriersTable({
  carriers,
  readOnly = false,
  onAction,
}: CarriersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carriers</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Carrier Name</TableHead>
              <TableHead>Driver Name</TableHead>
              <TableHead>MC Number</TableHead>
              <TableHead>Truck Type</TableHead>
              <TableHead>Assigned Team</TableHead>
              <TableHead>Assigned Dispatcher</TableHead>
              <TableHead>Dispatch Fee %</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carriers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-muted-foreground py-8 text-center"
                >
                  No carriers found.
                </TableCell>
              </TableRow>
            ) : (
              carriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium">
                    {carrier.carrierName}
                  </TableCell>
                  <TableCell>{carrier.driverName}</TableCell>
                  <TableCell>{carrier.mcNumber}</TableCell>
                  <TableCell>
                    {carrier.truckType.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell>{carrier.assignedTeamName}</TableCell>
                  <TableCell>{carrier.assignedDispatcherName}</TableCell>
                  <TableCell>{carrier.dispatchFeePercentage}%</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        carrier.status === TEAM_STATUS_ACTIVE
                          ? "default"
                          : "secondary"
                      }
                    >
                      {carrier.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateShort(carrier.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${carrier.carrierName}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onAction(carrier, "view")}
                        >
                          View
                        </DropdownMenuItem>
                        {!readOnly ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => onAction(carrier, "edit")}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAction(carrier, "reassign")}
                            >
                              Reassign
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAction(carrier, "toggle-status")}
                              variant={
                                carrier.status === TEAM_STATUS_ACTIVE
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {carrier.status === TEAM_STATUS_ACTIVE
                                ? "Deactivate"
                                : "Activate"}
                            </DropdownMenuItem>
                          </>
                        ) : null}
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
