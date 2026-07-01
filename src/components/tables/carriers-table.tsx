"use client";

import { Columns3, MoreHorizontal } from "lucide-react";

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

export type CarrierRowAction =
  | "view"
  | "edit"
  | "reassign"
  | "toggle-status"
  | "export";

type CarriersTableProps = {
  carriers: Carrier[];
  readOnly?: boolean;
  canExport?: boolean;
  onAction: (carrier: Carrier, action: CarrierRowAction) => void;
};

export function CarriersTable({
  carriers,
  readOnly = false,
  canExport = false,
  onAction,
}: CarriersTableProps) {
  return (
    <Card className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <CardHeader className="flex flex-col gap-3 border-b border-[#E2E8F0] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-[#0F172A]">
            Sales
          </CardTitle>
          <p className="mt-1 text-sm text-[#64748B]">
            Carrier records, assignments and dispatch fee details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm">
            <Columns3 className="mr-2 size-4" />
            Columns
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Sales table options"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow className="border-[#E2E8F0] hover:bg-[#F8FAFC]">
              <TableHead className="pl-6 text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Carrier Name
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Driver Name
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                MC Number
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Truck Type
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Assigned Team
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Assigned Dispatcher
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Dispatch Fee %
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Created Date
              </TableHead>
              <TableHead className="pr-6 text-right text-xs font-semibold whitespace-nowrap text-[#64748B] uppercase">
                Actions
              </TableHead>
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
                <TableRow
                  key={carrier.id}
                  className="border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
                >
                  <TableCell className="pl-6">
                    <button
                      type="button"
                      className="cursor-pointer text-left font-medium underline-offset-4 hover:text-blue-600 hover:underline focus-visible:text-blue-600 focus-visible:underline focus-visible:outline-none"
                      onClick={() => onAction(carrier, "view")}
                    >
                      {carrier.carrierName}
                    </button>
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
                      variant="outline"
                      className={
                        carrier.status === TEAM_STATUS_ACTIVE
                          ? "border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]"
                          : "border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]"
                      }
                    >
                      {carrier.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateShort(carrier.createdAt)}</TableCell>
                  <TableCell className="pr-6 text-right">
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
                        {canExport ? (
                          <DropdownMenuItem
                            onClick={() => onAction(carrier, "export")}
                          >
                            Export
                          </DropdownMenuItem>
                        ) : null}
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
