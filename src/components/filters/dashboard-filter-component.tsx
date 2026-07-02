"use client";

import { useMemo, useRef, useState } from "react";

import { SharedFilterButton } from "@/components/filters/shared-filter-button";
import { SharedFilterPopover } from "@/components/filters/shared-filter-popover";
import type { SharedDateRangeOption } from "@/components/filters/shared-date-range-filter";
import { FILTER_ALL } from "@/lib/constants/filters";

export type DashboardDateRangePreset =
  | "today"
  | "this-week"
  | "this-month"
  | "last-7-days"
  | "last-30-days"
  | "custom";

export type DashboardFilterValues = {
  dateRange: string;
  customDateFrom?: string;
  customDateTo?: string;
  teamId?: string;
  dispatcherId?: string;
  carrierId?: string;
};

export type DashboardFilterOption = {
  value: string;
  label: string;
  teamId?: string;
  dispatcherId?: string | null;
};

type DashboardFilterComponentProps<TFilters extends DashboardFilterValues> = {
  values: TFilters;
  defaultValues: TFilters;
  onApplyFilters: (values: TFilters) => void;
  allowedFilters?: {
    team?: boolean;
    dispatcher?: boolean;
    carrier?: boolean;
  };
  teamOptions?: DashboardFilterOption[];
  dispatcherOptions?: DashboardFilterOption[];
  carrierOptions?: DashboardFilterOption[];
  title?: string;
  description?: string;
  showActiveCount?: boolean;
};

const DATE_RANGE_OPTIONS: SharedDateRangeOption[] = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "custom", label: "Custom Date Range" },
];

function normalizeFilterValue(value?: string): string {
  return value && value !== FILTER_ALL ? value : FILTER_ALL;
}

function isActiveValue(value?: string): boolean {
  return Boolean(value && value !== FILTER_ALL);
}

function getDateRangeTriggerLabel(values: DashboardFilterValues): string {
  if (values.dateRange === "today") return "Today (Daily View)";

  return (
    DATE_RANGE_OPTIONS.find((option) => option.value === values.dateRange)
      ?.label ?? "Date Range"
  );
}

function filterByScope(
  options: DashboardFilterOption[],
  filters: DashboardFilterValues,
): DashboardFilterOption[] {
  return options.filter((option) => {
    if (isActiveValue(filters.teamId) && option.teamId !== undefined) {
      if (option.teamId !== filters.teamId) return false;
    }

    if (
      isActiveValue(filters.dispatcherId) &&
      option.dispatcherId !== undefined
    ) {
      if (option.dispatcherId !== filters.dispatcherId) return false;
    }

    return true;
  });
}

function DashboardSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: DashboardFilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-[#64748B]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm text-[#334155] outline-none transition focus:border-[#2563EB] focus:ring-3 focus:ring-[#DBEAFE]"
      >
        <option value={FILTER_ALL}>{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DashboardFilterComponent<
  TFilters extends DashboardFilterValues,
>({
  values,
  defaultValues,
  onApplyFilters,
  allowedFilters,
  teamOptions = [],
  dispatcherOptions = [],
  carrierOptions = [],
  title = "Dashboard Filters",
  description = "Choose a date range and optional quick filters.",
  showActiveCount = true,
}: DashboardFilterComponentProps<TFilters>) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TFilters>(values);

  const scopedDispatcherOptions = useMemo(
    () => filterByScope(dispatcherOptions, draftFilters),
    [dispatcherOptions, draftFilters],
  );

  const scopedCarrierOptions = useMemo(
    () => filterByScope(carrierOptions, draftFilters),
    [carrierOptions, draftFilters],
  );

  const activeCount = useMemo(() => {
    let count = values.dateRange !== "today" ? 1 : 0;
    if (allowedFilters?.team && isActiveValue(values.teamId)) count += 1;
    if (allowedFilters?.dispatcher && isActiveValue(values.dispatcherId)) {
      count += 1;
    }
    if (allowedFilters?.carrier && isActiveValue(values.carrierId)) count += 1;
    return showActiveCount ? count : 0;
  }, [
    allowedFilters?.carrier,
    allowedFilters?.dispatcher,
    allowedFilters?.team,
    showActiveCount,
    values.carrierId,
    values.dateRange,
    values.dispatcherId,
    values.teamId,
  ]);

  function patchDraft(next: Partial<DashboardFilterValues>) {
    setDraftFilters((current) => {
      const merged = { ...current, ...next } as TFilters;

      if (next.teamId !== undefined) {
        const validDispatchers = new Set(
          dispatcherOptions
            .filter((option) =>
              isActiveValue(merged.teamId)
                ? option.teamId === merged.teamId
                : true,
            )
            .map((option) => option.value),
        );

        if (
          isActiveValue(merged.dispatcherId) &&
          !validDispatchers.has(merged.dispatcherId!)
        ) {
          merged.dispatcherId = FILTER_ALL;
        }
      }

      if (next.teamId !== undefined || next.dispatcherId !== undefined) {
        const validCarriers = new Set(
          carrierOptions
            .filter((option) => {
              if (isActiveValue(merged.teamId) && option.teamId !== undefined) {
                if (option.teamId !== merged.teamId) return false;
              }
              if (
                isActiveValue(merged.dispatcherId) &&
                option.dispatcherId !== undefined
              ) {
                if (option.dispatcherId !== merged.dispatcherId) return false;
              }
              return true;
            })
            .map((option) => option.value),
        );

        if (
          isActiveValue(merged.carrierId) &&
          !validCarriers.has(merged.carrierId!)
        ) {
          merged.carrierId = FILTER_ALL;
        }
      }

      return merged;
    });
  }

  function handleOpen() {
    setDraftFilters(values);
    setOpen((current) => !current);
  }

  function handleApply() {
    onApplyFilters(draftFilters);
    setOpen(false);
  }

  function handleReset() {
    setDraftFilters(defaultValues);
    onApplyFilters(defaultValues);
    setOpen(false);
  }

  return (
    <>
      <div ref={buttonRef}>
        <SharedFilterButton
          activeCount={activeCount}
          open={open}
          label={getDateRangeTriggerLabel(values)}
          onClick={handleOpen}
        />
      </div>

      <SharedFilterPopover
        open={open}
        anchorRef={buttonRef}
        title={title}
        description={description}
        dateRange={{
          name: "dashboard-date-range",
          value: draftFilters.dateRange,
          options: DATE_RANGE_OPTIONS,
          onChange: (dateRange) => patchDraft({ dateRange }),
          customDateFrom: draftFilters.customDateFrom,
          customDateTo: draftFilters.customDateTo,
          onCustomDateFromChange: (customDateFrom) =>
            patchDraft({ customDateFrom }),
          onCustomDateToChange: (customDateTo) =>
            patchDraft({ customDateTo }),
        }}
        groups={[]}
        onApply={handleApply}
        onReset={handleReset}
        onClose={() => setOpen(false)}
      >
        {allowedFilters?.team ||
        allowedFilters?.dispatcher ||
        allowedFilters?.carrier ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">
              Quick Filters
            </h3>
            <div className="space-y-3">
              {allowedFilters?.team ? (
                <DashboardSelect
                  id="dashboard-filter-team"
                  label="Team"
                  value={normalizeFilterValue(draftFilters.teamId)}
                  allLabel="All Teams"
                  options={teamOptions}
                  onChange={(teamId) => patchDraft({ teamId })}
                />
              ) : null}
              {allowedFilters?.dispatcher ? (
                <DashboardSelect
                  id="dashboard-filter-dispatcher"
                  label="Dispatcher"
                  value={normalizeFilterValue(draftFilters.dispatcherId)}
                  allLabel="All Dispatchers"
                  options={scopedDispatcherOptions}
                  onChange={(dispatcherId) => patchDraft({ dispatcherId })}
                />
              ) : null}
              {allowedFilters?.carrier ? (
                <DashboardSelect
                  id="dashboard-filter-carrier"
                  label="Carrier"
                  value={normalizeFilterValue(draftFilters.carrierId)}
                  allLabel="All Carriers"
                  options={scopedCarrierOptions}
                  onChange={(carrierId) => patchDraft({ carrierId })}
                />
              ) : null}
            </div>
          </section>
        ) : null}
      </SharedFilterPopover>
    </>
  );
}
