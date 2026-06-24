"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  Ban,
  CircleDollarSign,
  PackageCheck,
  PackageX,
  PauseCircle,
  RefreshCw,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { LoadStatusDonutChart } from "@/components/dashboard/admin/load-status-donut-chart";
import { DashboardMetricCard } from "@/components/dashboard/admin/dashboard-metric-card";
import { DailyReportFilterBar } from "@/components/daily-report/daily-report-filter-bar";
import {
  RevenueByTeamChart,
  TeamComparisonChart,
} from "@/components/daily-report/daily-report-charts";
import { LiveActivityTable } from "@/components/daily-report/live-activity-table";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useDailyReportRealtime } from "@/hooks/use-daily-report-realtime";
import { fetchAdminDailyReport } from "@/lib/api/resources";
import {
  createDefaultDailyReportFilters,
  dailyReportFiltersToParams,
  type DailyReportFilterValues,
} from "@/lib/dashboard/daily-report-filter-params";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

export function AdminDailyReportPage() {
  const [filters, setFilters] = useState<DailyReportFilterValues>(
    createDefaultDailyReportFilters,
  );

  const loadReport = useCallback(
    () => fetchAdminDailyReport(dailyReportFiltersToParams(filters)),
    [filters],
  );

  const {
    data: report,
    error,
    isLoading,
    reload,
  } = useApiData(loadReport, [filters]);

  useDailyReportRealtime({ onRefresh: reload });

  const summary = report?.summary;

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const filterOptions = report?.filterOptions ?? {
    teams: [],
    dispatchers: [],
    statuses: [],
  };

  const metricCards = useMemo(
    () => [
      {
        label: "Total Activities",
        value: (summary?.totalActivities ?? 0).toLocaleString(),
        helper: "Logged for selected date",
        accent: "#2563EB",
        iconBackground: "#DBEAFE",
        icon: Activity,
      },
      {
        label: "Delivered Loads",
        value: (summary?.deliveredLoads ?? 0).toLocaleString(),
        helper: "Completed deliveries",
        accent: "#22C55E",
        iconBackground: "#DCFCE7",
        icon: PackageCheck,
      },
      {
        label: "Cancelled Loads",
        value: (summary?.cancelledLoads ?? 0).toLocaleString(),
        helper: "Cancelled today",
        accent: "#EF4444",
        iconBackground: "#FEE2E2",
        icon: PackageX,
      },
      {
        label: "Not Booked",
        value: (summary?.notBooked ?? 0).toLocaleString(),
        helper: "No load booked",
        accent: "#F97316",
        iconBackground: "#FFEDD5",
        icon: Ban,
      },
      {
        label: "Not Working",
        value: (summary?.notWorking ?? 0).toLocaleString(),
        helper: "Carrier not working",
        accent: "#3B82F6",
        iconBackground: "#DBEAFE",
        icon: PauseCircle,
      },
      {
        label: "Total Revenue",
        value: formatCurrencyCompact(summary?.totalRevenue ?? 0, "$0"),
        helper: "From delivered loads",
        accent: "#14B8A6",
        iconBackground: "#CCFBF1",
        icon: CircleDollarSign,
      },
      {
        label: "Dispatch Fees",
        value: formatCurrencyCompact(summary?.dispatchFees ?? 0, "$0"),
        helper: "Collected dispatch fees",
        accent: "#8B5CF6",
        iconBackground: "#F3E8FF",
        icon: Wallet,
      },
      {
        label: "Active Dispatchers",
        value: (summary?.activeDispatchers ?? 0).toLocaleString(),
        helper: "With activity today",
        accent: "#F97316",
        iconBackground: "#FFEDD5",
        icon: Users,
      },
      {
        label: "Active Carriers",
        value: (summary?.activeCarriers ?? 0).toLocaleString(),
        helper: "With activity today",
        accent: "#2563EB",
        iconBackground: "#DBEAFE",
        icon: Truck,
      },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
            Daily Report
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Real-time operational snapshot of daily load activity across teams.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-[#E2E8F0] bg-white"
          onClick={() => void reload()}
          disabled={isLoading}
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <DailyReportFilterBar
        values={filters}
        filterOptions={filterOptions}
        onChange={setFilters}
      />

      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading daily report"
        emptyTitle="No activity for this date"
        emptyDescription="There are no daily activity records for the selected date and filters."
        errorTitle="Unable to load daily report"
        errorDescription={
          error ??
          "Daily report data could not be loaded. Try again in a moment."
        }
      >
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricCards.map((card) => (
              <DashboardMetricCard key={card.label} {...card} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TeamComparisonChart data={report?.teamComparison ?? []} />
            <RevenueByTeamChart data={report?.revenueByTeam ?? []} />
          </div>

          <LoadStatusDonutChart
            data={report?.statusBreakdown ?? []}
            totalLoads={summary?.totalActivities ?? 0}
          />

          <LiveActivityTable rows={report?.liveActivities ?? []} />
        </>
      </PageContentGate>
    </div>
  );
}
