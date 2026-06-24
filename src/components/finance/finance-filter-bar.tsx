"use client";

import { FINANCE_DATE_RANGE_OPTIONS } from "@/lib/constants/finance-date-ranges";
import { FILTER_ALL } from "@/lib/constants/filters";
import type { FinanceFilterValues } from "@/lib/dashboard/finance-filter-params";
import type { DispatcherFinanceBundle } from "@/lib/types";
import { formatDateRangeLabel } from "@/lib/utils/resolve-date-range-preset";
import { resolveFinanceDateRange } from "@/lib/utils/resolve-finance-date-range";

import { FilterField } from "@/components/filters/filter-field";
import { StatusFilter } from "@/components/filters/status-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FinanceFilterBarProps = {
  values: FinanceFilterValues;
  filterOptions: DispatcherFinanceBundle["filterOptions"];
  onChange: (values: FinanceFilterValues) => void;
  onApply: () => void;
};

export function FinanceFilterBar({
  values,
  filterOptions,
  onChange,
  onApply,
}: FinanceFilterBarProps) {
  const dateRangeLabel =
    values.dateRange === "custom" && values.dateFrom && values.dateTo
      ? formatDateRangeLabel(values.dateFrom, values.dateTo)
      : (() => {
          try {
            const { dateFrom, dateTo } = resolveFinanceDateRange(
              values.dateRange,
            );
            return formatDateRangeLabel(dateFrom, dateTo);
          } catch {
            return "Select dates";
          }
        })();

  const carrierLabel =
    values.carrierId === FILTER_ALL
      ? "All Carriers"
      : (filterOptions.carriers.find(
          (carrier) => carrier.id === values.carrierId,
        )?.name ?? "All Carriers");

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 py-4">
        <FilterField label="Date Range">
          <Select
            value={values.dateRange}
            onValueChange={(dateRange) => {
              if (dateRange) {
                onChange({ ...values, dateRange });
              }
            }}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder={dateRangeLabel}>
                {dateRangeLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FINANCE_DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {values.dateRange === "custom" ? (
          <>
            <FilterField label="Start Date">
              <Input
                type="date"
                value={values.dateFrom}
                onChange={(event) =>
                  onChange({ ...values, dateFrom: event.target.value })
                }
                className="h-8"
              />
            </FilterField>
            <FilterField label="End Date">
              <Input
                type="date"
                value={values.dateTo}
                onChange={(event) =>
                  onChange({ ...values, dateTo: event.target.value })
                }
                className="h-8"
              />
            </FilterField>
          </>
        ) : null}

        <FilterField label="Carrier">
          <Select
            value={values.carrierId}
            onValueChange={(carrierId) => {
              if (carrierId) {
                onChange({ ...values, carrierId });
              }
            }}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder={carrierLabel}>
                {carrierLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Carriers</SelectItem>
              {filterOptions.carriers.map((carrier) => (
                <SelectItem key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <StatusFilter
          value={values.status}
          onValueChange={(status) => {
            if (status) {
              onChange({ ...values, status });
            }
          }}
        />

        <Button type="button" size="sm" className="mb-0.5" onClick={onApply}>
          Apply filters
        </Button>
      </CardContent>
    </Card>
  );
}
