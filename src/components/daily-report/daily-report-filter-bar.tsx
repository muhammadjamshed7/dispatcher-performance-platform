"use client";

import { Filter } from "lucide-react";

import { FilterField } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DailyReportFilterValues } from "@/lib/dashboard/daily-report-filter-params";

type DailyReportFilterBarProps = {
  values: DailyReportFilterValues;
  filterOptions: {
    teams: { id: string; name: string }[];
    dispatchers: { id: string; name: string; teamId: string }[];
    statuses: { value: string; label: string }[];
  };
  onChange: (values: DailyReportFilterValues) => void;
};

const selectTriggerClassName =
  "flex h-11 w-full items-center justify-between rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm text-[#334155] shadow-none";

export function DailyReportFilterBar({
  values,
  filterOptions,
  onChange,
}: DailyReportFilterBarProps) {
  const visibleDispatchers =
    values.teamId === "all"
      ? filterOptions.dispatchers
      : filterOptions.dispatchers.filter(
          (dispatcher) => dispatcher.teamId === values.teamId,
        );

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#0F172A]">
        <Filter className="size-4 text-[#64748B]" />
        Filters
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FilterField label="Date">
          <Input
            type="date"
            value={values.date}
            onChange={(event) =>
              onChange({ ...values, date: event.target.value })
            }
            className={selectTriggerClassName}
          />
        </FilterField>

        <FilterField label="Team">
          <Select
            value={values.teamId}
            onValueChange={(teamId) => {
              if (!teamId) {
                return;
              }

              onChange({
                ...values,
                teamId,
                dispatcherId: "all",
              });
            }}
          >
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {filterOptions.teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Dispatcher">
          <Select
            value={values.dispatcherId}
            onValueChange={(dispatcherId) => {
              if (dispatcherId) {
                onChange({ ...values, dispatcherId });
              }
            }}
          >
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue placeholder="All dispatchers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dispatchers</SelectItem>
              {visibleDispatchers.map((dispatcher) => (
                <SelectItem key={dispatcher.id} value={dispatcher.id}>
                  {dispatcher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Status">
          <Select
            value={values.status}
            onValueChange={(status) => {
              if (status) {
                onChange({ ...values, status });
              }
            }}
          >
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {filterOptions.statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>
    </div>
  );
}
