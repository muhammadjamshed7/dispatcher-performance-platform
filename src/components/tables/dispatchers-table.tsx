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
import type { Dispatcher } from "@/lib/types";
import { formatDateShort } from "@/lib/utils/format-date";

export type DispatcherRowAction = "view" | "edit" | "toggle-status" | "finance";

type DispatchersTableProps = {
  dispatchers: Dispatcher[];
  onAction: (dispatcher: Dispatcher, action: DispatcherRowAction) => void;
  showFinanceAction?: boolean;
};

export function DispatchersTable({
  dispatchers,
  onAction,
  showFinanceAction = false,
}: DispatchersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatchers</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned Carriers</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispatchers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground py-8 text-center"
                >
                  No dispatchers found.
                </TableCell>
              </TableRow>
            ) : (
              dispatchers.map((dispatcher) => (
                <TableRow key={dispatcher.id}>
                  <TableCell className="font-medium">
                    {dispatcher.fullName}
                  </TableCell>
                  <TableCell>{dispatcher.email}</TableCell>
                  <TableCell>{dispatcher.phoneNumber}</TableCell>
                  <TableCell>{dispatcher.teamName}</TableCell>
                  <TableCell>{dispatcher.role.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        dispatcher.status === TEAM_STATUS_ACTIVE
                          ? "default"
                          : "secondary"
                      }
                    >
                      {dispatcher.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{dispatcher.assignedCarriersCount}</TableCell>
                  <TableCell>{formatDateShort(dispatcher.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${dispatcher.fullName}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onAction(dispatcher, "view")}
                        >
                          View
                        </DropdownMenuItem>
                        {showFinanceAction ? (
                          <DropdownMenuItem
                            onClick={() => onAction(dispatcher, "finance")}
                          >
                            Finance
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onClick={() => onAction(dispatcher, "edit")}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onAction(dispatcher, "toggle-status")}
                          variant={
                            dispatcher.status === TEAM_STATUS_ACTIVE
                              ? "destructive"
                              : "default"
                          }
                        >
                          {dispatcher.status === TEAM_STATUS_ACTIVE
                            ? "Deactivate"
                            : "Activate"}
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
