"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { CarrierReportTable } from "@/components/tables/carrier-report-table";
import { DailyReportTable } from "@/components/tables/daily-report-table";
import { DispatcherReportTable } from "@/components/tables/dispatcher-report-table";
import { TeamReportTable } from "@/components/tables/team-report-table";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { ApiClientError } from "@/lib/api/client";
import { exportReportRequest, fetchReports } from "@/lib/api/resources";
import type { ReportPeriod } from "@/lib/constants/report-periods";
import {
  DEFAULT_REPORT_FILTERS,
  reportFiltersToParams,
  type ReportFilterValues,
} from "@/lib/dashboard/report-filter-params";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type ReportTab = "daily" | "weekly" | "monthly" | "historical";

const REPORT_TABS: { id: ReportTab; label: string; period: ReportPeriod }[] = [
  { id: "daily", label: "Daily Report", period: "DAILY" },
  { id: "weekly", label: "Weekly Report", period: "WEEKLY" },
  { id: "monthly", label: "Monthly Report", period: "MONTHLY" },
  { id: "historical", label: "Historical Report", period: "HISTORICAL" },
];

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

export function ReportsPageContent() {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [filters, setFilters] = useState<ReportFilterValues>(DEFAULT_REPORT_FILTERS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeConfig =
    REPORT_TABS.find((tab) => tab.id === activeTab) ?? REPORT_TABS[0];

  const loadReport = useCallback(
    () =>
      fetchReports(reportFiltersToParams(activeConfig.period, filters)),
    [activeConfig.period, filters],
  );

  const { data: activeReport, error, isLoading, reload } = useApiData(
    loadReport,
    [activeTab, filters],
  );

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

  async function handleExport() {
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
    }
  }

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

  return (
    <>
      <PageShell
        title="Reports"
        description="Daily, weekly, monthly, and historical performance reports."
      >
        <RoleScopeBanner message="Reports are scoped to your role and team access." />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {REPORT_TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeTab === tab.id ? "default" : "outline"}
                size="sm"
                className={cn(activeTab === tab.id && "shadow-sm")}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle={`Loading ${activeConfig.label.toLowerCase()}`}
          emptyTitle="No report data"
          emptyDescription="There is no report data for the selected period and filters."
          errorTitle="Unable to load report"
          errorDescription={
            error ?? "The report preview could not be loaded. Try again or switch tabs."
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

      <AppToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
