"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { CarrierReportTable } from "@/components/tables/carrier-report-table";
import { DailyReportTable } from "@/components/tables/daily-report-table";
import { DispatcherReportTable } from "@/components/tables/dispatcher-report-table";
import { TeamReportTable } from "@/components/tables/team-report-table";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { ApiClientError } from "@/lib/api/client";
import { exportReportRequest, fetchReports } from "@/lib/api/resources";
import { DATE_RANGE_OPTIONS } from "@/lib/constants/date-ranges";
import { FILTER_ALL } from "@/lib/constants/filters";
import type { ReportPeriod } from "@/lib/constants/report-periods";
import {
  DEFAULT_REPORT_FILTERS,
  reportFiltersToParams,
  type ReportFilterValues,
} from "@/lib/dashboard/report-filter-params";
import { exportPerformanceReportPdf } from "@/lib/reports/export-performance-report-pdf";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

type ReportTab = "daily" | "weekly" | "monthly" | "historical" | "custom";

const REPORT_TABS: {
  id: ReportTab;
  label: string;
  pdfLabel: string;
  period: ReportPeriod;
}[] = [
  { id: "daily", label: "Daily Report", pdfLabel: "Daily", period: "DAILY" },
  {
    id: "weekly",
    label: "Weekly Report",
    pdfLabel: "Weekly",
    period: "WEEKLY",
  },
  {
    id: "monthly",
    label: "Monthly Report",
    pdfLabel: "Monthly",
    period: "MONTHLY",
  },
  {
    id: "historical",
    label: "Historical Report",
    pdfLabel: "Historical",
    period: "HISTORICAL",
  },
  {
    id: "custom",
    label: "Custom Range",
    pdfLabel: "Custom",
    period: "CUSTOM",
  },
];

const REPORT_TAB_DATE_RANGES: Record<ReportTab, string> = {
  daily: "today",
  weekly: "last-7-days",
  monthly: "this-month",
  historical: "this-month",
  custom: "this-month",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function isReportEmpty(report: {
  daily: unknown[];
  dispatchers: unknown[];
  carriers: unknown[];
  teams: unknown[];
}) {
  return (
    report.daily.length === 0 &&
    report.dispatchers.length === 0 &&
    report.carriers.length === 0 &&
    report.teams.length === 0
  );
}

function formatDateLabel(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return formatDateLabel(dateFrom);
  }

  return `${formatDateLabel(dateFrom)} to ${formatDateLabel(dateTo)}`;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveReportDateRangeLabel(
  period: ReportPeriod,
  filters: ReportFilterValues,
) {
  if (period === "HISTORICAL") {
    const today = resolveDateRangePreset("today").dateTo;
    return formatDateRangeLabel("2000-01-01", today);
  }

  if (period === "CUSTOM") {
    const range =
      filters.dateFrom && filters.dateTo
        ? { dateFrom: filters.dateFrom, dateTo: filters.dateTo }
        : resolveDateRangePreset("this-month");

    return formatDateRangeLabel(range.dateFrom, range.dateTo);
  }

  const preset =
    period === "DAILY"
      ? "today"
      : period === "WEEKLY"
        ? "last-7-days"
        : "this-month";
  const range = resolveDateRangePreset(preset);
  const presetLabel =
    DATE_RANGE_OPTIONS.find((option) => option.value === preset)?.label ??
    formatEnumLabel(preset);

  return `${presetLabel} (${formatDateRangeLabel(range.dateFrom, range.dateTo)})`;
}

export function ReportsPageContent() {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [filters, setFilters] = useState<ReportFilterValues>(
    DEFAULT_REPORT_FILTERS,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const { teams, dispatchers, carriers } = useEntityOptions();

  const activeConfig =
    REPORT_TABS.find((tab) => tab.id === activeTab) ?? REPORT_TABS[0];

  const loadReport = useCallback(
    () => fetchReports(reportFiltersToParams(activeConfig.period, filters)),
    [activeConfig.period, filters],
  );

  const {
    data: activeReport,
    error,
    isLoading,
    reload,
  } = useApiData(loadReport, [activeTab, filters]);

  const isEmpty =
    !isLoading && !error && activeReport ? isReportEmpty(activeReport) : false;

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const report = activeReport ?? {
    summary: {
      revenue: 0,
      dispatchFees: 0,
      deliveredLoads: 0,
      cancelledLoads: 0,
      activeCarriers: 0,
    },
    daily: [],
    dispatchers: [],
    carriers: [],
    teams: [],
  };

  const dateRangeLabel = useMemo(
    () => resolveReportDateRangeLabel(activeConfig.period, filters),
    [activeConfig.period, filters],
  );

  const appliedPdfFilters = useMemo(
    () => [
      {
        label: "Team",
        value:
          filters.teamId === FILTER_ALL
            ? "All teams"
            : (teams.find((team) => team.id === filters.teamId)?.name ??
              filters.teamId),
      },
      {
        label: "Dispatcher",
        value:
          filters.dispatcherId === FILTER_ALL
            ? "All dispatchers"
            : (dispatchers.find(
                (dispatcher) => dispatcher.id === filters.dispatcherId,
              )?.fullName ?? filters.dispatcherId),
      },
      {
        label: "Carrier",
        value:
          filters.carrierId === FILTER_ALL
            ? "All carriers"
            : (carriers.find((carrier) => carrier.id === filters.carrierId)
                ?.carrierName ?? filters.carrierId),
      },
      {
        label: "Truck Type",
        value:
          filters.truckType === FILTER_ALL
            ? "All types"
            : formatEnumLabel(filters.truckType),
      },
      {
        label: "Status",
        value:
          filters.status === FILTER_ALL
            ? "All statuses"
            : formatEnumLabel(filters.status),
      },
    ],
    [carriers, dispatchers, filters, teams],
  );

  function handleTabChange(tab: ReportTab) {
    const customRange = resolveDateRangePreset("this-month");

    setActiveTab(tab);
    setFilters((current) => ({
      ...current,
      dateRange: REPORT_TAB_DATE_RANGES[tab],
      ...(tab === "custom"
        ? {
            dateFrom: current.dateFrom || customRange.dateFrom,
            dateTo: current.dateTo || customRange.dateTo,
          }
        : {}),
    }));
  }

  async function handleExportCsv() {
    setExporting("csv");

    try {
      const result = await exportReportRequest(
        reportFiltersToParams(activeConfig.period, filters),
      );
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${result.rowCount} rows to ${result.fileName}.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to export report."));
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    setExporting("pdf");

    try {
      await exportPerformanceReportPdf({
        report,
        reportTypeLabel: activeConfig.pdfLabel,
        dateRangeLabel,
        appliedFilters: appliedPdfFilters,
      });
      showToast(`Exported ${activeConfig.pdfLabel.toLowerCase()} report PDF.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to export report PDF."));
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <PageShell
        title="Reports"
        description="Daily, weekly, monthly, and historical performance reports."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {REPORT_TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeTab === tab.id ? "default" : "outline"}
                size="sm"
                className={cn(activeTab === tab.id && "shadow-sm")}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={isLoading || Boolean(error) || exporting !== null}
            >
              <Download className="size-4" />
              {exporting === "csv" ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPdf}
              disabled={isLoading || Boolean(error) || exporting !== null}
            >
              <FileText className="size-4" />
              {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle={`Loading ${activeConfig.label.toLowerCase()}`}
          emptyTitle="No report data"
          emptyDescription="There is no report data for the selected period and filters."
          errorTitle="Unable to load report"
          errorDescription={
            error ??
            "The report preview could not be loaded. Try again or switch tabs."
          }
        >
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Revenue"
                value={formatCurrencyCompact(report.summary.revenue)}
              />
              <MetricCard
                label="Dispatch Fees"
                value={formatCurrencyCompact(report.summary.dispatchFees)}
              />
              <MetricCard
                label="Delivered Loads"
                value={report.summary.deliveredLoads.toString()}
              />
              <MetricCard
                label="Cancelled Loads"
                value={report.summary.cancelledLoads.toString()}
              />
              <MetricCard
                label="Active Carriers"
                value={report.summary.activeCarriers.toString()}
              />
            </div>

            <ReportFilterBar
              values={filters}
              onChange={setFilters}
              onApply={() => void reload()}
              showCustomDates={activeTab === "custom"}
            />

            <DailyReportTable
              rows={report.daily}
              title={`${activeConfig.label} — Activity Detail`}
            />
            <DispatcherReportTable rows={report.dispatchers} />
            <CarrierReportTable rows={report.carriers} />
            <TeamReportTable rows={report.teams} />
          </>
        </PageContentGate>
      </PageShell>

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}
