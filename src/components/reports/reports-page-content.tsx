"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import { MockToast } from "@/components/feedback/mock-toast";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { CarrierReportTable } from "@/components/tables/carrier-report-table";
import { DailyReportTable } from "@/components/tables/daily-report-table";
import { DispatcherReportTable } from "@/components/tables/dispatcher-report-table";
import { TeamReportTable } from "@/components/tables/team-report-table";
import { Button } from "@/components/ui/button";
import { useMockPageState } from "@/hooks/use-mock-page-state";
import { cn } from "@/lib/utils";
import {
  mockDailyReport,
  mockHistoricalReport,
  mockMonthlyReport,
  mockWeeklyReport,
  type ReportBundle,
} from "@/lib/mock-data";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type ReportTab = "daily" | "weekly" | "monthly" | "historical";

const REPORT_TABS: { id: ReportTab; label: string; data: ReportBundle }[] = [
  { id: "daily", label: "Daily Report", data: mockDailyReport },
  { id: "weekly", label: "Weekly Report", data: mockWeeklyReport },
  { id: "monthly", label: "Monthly Report", data: mockMonthlyReport },
  {
    id: "historical",
    label: "Historical Report",
    data: mockHistoricalReport,
  },
];

export function ReportsPageContent() {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeReport =
    REPORT_TABS.find((tab) => tab.id === activeTab)?.data ?? mockDailyReport;
  const activeLabel =
    REPORT_TABS.find((tab) => tab.id === activeTab)?.label ?? "Daily Report";

  const isEmpty =
    activeReport.daily.length === 0 &&
    activeReport.dispatchers.length === 0 &&
    activeReport.carriers.length === 0 &&
    activeReport.teams.length === 0;

  const { state, retry } = useMockPageState({
    isEmpty,
    resetKey: activeTab,
  });

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  return (
    <>
      <PageShell
        title="Reports"
        description="Preview daily, weekly, monthly, and historical performance reports using mock data only."
      >
        <RoleScopeBanner message="Reports use mock data. Team Lead view is scoped to your team when filters are connected." />

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

          <Button
            type="button"
            variant="outline"
            onClick={() => showToast("CSV export will be connected later.")}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>

        <PageContentGate
          state={state}
          onRetry={retry}
          loadingTitle={`Loading ${activeLabel.toLowerCase()}`}
          emptyTitle="No report data"
          emptyDescription="There is no mock report data for the selected period and filters."
          errorTitle="Unable to load report"
          errorDescription="The report preview could not be loaded. Try again or switch tabs."
        >
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Revenue"
                value={formatCurrencyCompact(activeReport.summary.revenue)}
              />
              <MetricCard
                label="Dispatch Fees"
                value={formatCurrencyCompact(activeReport.summary.dispatchFees)}
              />
              <MetricCard
                label="Delivered Loads"
                value={activeReport.summary.deliveredLoads.toString()}
              />
              <MetricCard
                label="Cancelled Loads"
                value={activeReport.summary.cancelledLoads.toString()}
              />
              <MetricCard
                label="Active Carriers"
                value={activeReport.summary.activeCarriers.toString()}
              />
            </div>

            <ReportFilterBar
              onApply={() => showToast("Filters will be connected later.")}
            />

            <DailyReportTable
              rows={activeReport.daily}
              title={`${activeLabel} — Activity Detail`}
            />
            <DispatcherReportTable rows={activeReport.dispatchers} />
            <CarrierReportTable rows={activeReport.carriers} />
            <TeamReportTable rows={activeReport.teams} />
          </>
        </PageContentGate>
      </PageShell>

      <MockToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
