"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import type { Team } from "@/lib/types";
import { formatDateShort } from "@/lib/utils/format-date";

export type TeamRowAction = "view" | "edit" | "toggle-status";

export type TeamTableMetrics = {
  score: number;
  color: string;
  initials: string;
};

type TeamsTableProps = {
  teams: Team[];
  metricsByTeamId?: Record<string, TeamTableMetrics>;
  onAction: (team: Team, action: TeamRowAction) => void;
};

export function TeamsTable({
  teams,
  metricsByTeamId = {},
  onAction,
}: TeamsTableProps) {
  const [search, setSearch] = useState("");
  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return teams;
    }

    return teams.filter((team) =>
      [team.name, team.teamLeadName, team.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, teams]);

  return (
    <Card className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <CardHeader className="flex flex-col gap-3 border-b border-[#E2E8F0] sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base font-semibold text-[#0F172A]">
          Teams
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teams..."
              className="h-9 w-full min-w-56 rounded-lg border-[#CBD5E1] bg-white pl-9 text-sm shadow-sm sm:w-64"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Teams table options"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#F8FAFC]">
              <TableRow className="border-[#E2E8F0] hover:bg-[#F8FAFC]">
                <TableHead className="pl-5 text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Team Name
                </TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Team Lead
                </TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Dispatchers Count
                </TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Carriers Count
                </TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Performance Score
                </TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Created Date
                </TableHead>
                <TableHead className="pr-5 text-right text-xs font-semibold whitespace-nowrap text-[#64748B]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-[#64748B]"
                  >
                    No teams found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeams.map((team) => {
                  const metrics = metricsByTeamId[team.id];
                  const score = metrics?.score ?? 0;
                  const color = metrics?.color ?? "#2563EB";
                  const initials =
                    metrics?.initials ?? getFallbackInitials(team.name);

                  return (
                    <TableRow
                      key={team.id}
                      className="border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
                    >
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: color }}
                          >
                            {initials}
                          </span>
                          <span className="font-semibold whitespace-nowrap text-[#0F172A]">
                            {team.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#334155]">
                        {team.teamLeadName || "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            team.status === TEAM_STATUS_ACTIVE
                              ? "border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]"
                              : "border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]"
                          }
                        >
                          {team.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[#334155]">
                        {team.dispatchersCount}
                      </TableCell>
                      <TableCell className="text-[#334155]">
                        {team.carriersCount}
                      </TableCell>
                      <TableCell className="min-w-48">
                        <div className="flex items-center gap-3">
                          <span className="w-10 text-sm font-bold text-[#0F172A]">
                            {score.toFixed(1)}
                          </span>
                          <span className="h-2 w-28 overflow-hidden rounded-full bg-[#E2E8F0]">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, score))}%`,
                                backgroundColor: color,
                              }}
                            />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#334155]">
                        {formatDateShort(team.createdAt)}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
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
                            <DropdownMenuItem
                              onClick={() => onAction(team, "view")}
                            >
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAction(team, "edit")}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAction(team, "toggle-status")}
                              variant={
                                team.status === TEAM_STATUS_ACTIVE
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {team.status === TEAM_STATUS_ACTIVE
                                ? "Deactivate"
                                : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#E2E8F0] px-5 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filteredTeams.length === 0 ? 0 : 1} to{" "}
            {filteredTeams.length} of {filteredTeams.length} teams
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" disabled>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB] text-xs font-bold text-white">
              1
            </span>
            <Button type="button" variant="outline" size="icon-sm" disabled>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getFallbackInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TM";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
