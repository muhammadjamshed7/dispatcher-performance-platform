"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Team } from "@/lib/types";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { formatDateShort } from "@/lib/utils/format-date";
import { MoreHorizontal } from "lucide-react";

export type TeamRowAction = "view" | "edit" | "deactivate";

type TeamsTableProps = {
  teams: Team[];
  onAction: (team : Team, action: TeamRowAction) => void;
};

export function TeamsTable({ teams, onAction }: TeamsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Team Lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dispatchers Count</TableHead>
              <TableHead>Carriers Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No teams found.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.teamLeadName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        team.status === TEAM_STATUS_ACTIVE
                          ? "default"
                          : "secondary"
                      }
                    >
                      {team.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{team.dispatchersCount}</TableCell>
                  <TableCell>{team.carriersCount}</TableCell>
                  <TableCell>{formatDateShort(team.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${team.name}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAction(team, "view")}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAction(team, "edit")}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onAction(team, "deactivate")}
                          variant="destructive"
                        >
                          Deactivate
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
