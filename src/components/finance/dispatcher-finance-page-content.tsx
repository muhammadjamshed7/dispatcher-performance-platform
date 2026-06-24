"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { FinanceCarrierTable } from "@/components/finance/finance-carrier-table";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { FinanceFilterBar } from "@/components/finance/finance-filter-bar";
import { FinanceLoadTable } from "@/components/finance/finance-load-table";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiData } from "@/hooks/use-api-data";
import { ApiClientError } from "@/lib/api/client";
import {
  exportAdminDispatcherFinanceRequest,
  exportDispatcherFinanceRequest,
  fetchAdminDispatcherFinance,
  fetchDispatcherFinance,
} from "@/lib/api/resources";
import {
  DEFAULT_FINANCE_FILTERS,
  financeFiltersToParams,
  type FinanceFilterValues,
} from "@/lib/dashboard/finance-filter-params";
import type { DispatcherFinanceBundle } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatGrowthLabel } from "@/lib/utils/resolve-date-range-preset";
import { formatPercent } from "@/lib/utils/format-percent";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import { cn } from "@/lib/utils";

type DispatcherFinancePageContentProps = {
  variant: "dispatcher" | "admin";
  dispatcherId?: string;
  backHref?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function isFinanceEmpty(bundle: DispatcherFinanceBundle) {
  return (
    bundle.loadHistory.length === 0 &&
    bundle.carrierBreakdown.length === 0 &&
    bundle.summary.deliveredLoads === 0
  );
}

export function DispatcherFinancePageContent({
  variant,
  dispatcherId,
  backHref,
}: DispatcherFinancePageContentProps) {
  const [draftFilters, setDraftFilters] = useState<FinanceFilterValues>(
    DEFAULT_FINANCE_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<FinanceFilterValues>(
    DEFAULT_FINANCE_FILTERS,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadFinance = useCallback(() => {
    const params = financeFiltersToParams(appliedFilters);

    if (variant === "admin") {
      if (!dispatcherId) {
        return Promise.reject(new Error("Dispatcher ID is required."));
      }

      return fetchAdminDispatcherFinance(dispatcherId, params);
    }

    return fetchDispatcherFinance(params);
  }, [appliedFilters, dispatcherId, variant]);

  const { data, error, isLoading, reload } = useApiData(loadFinance, [
    appliedFilters,
    variant,
    dispatcherId,
  ]);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : data && isFinanceEmpty(data)
        ? "empty"
        : "ready";

  const monthlyComparisonLabel = useMemo(() => {
    if (!data) {
      return null;
    }

    return formatGrowthLabel(
      data.summary.monthOverMonthRevenueChange,
      "vs last month",
    );
  }, [data]);

  async function handleExportCsv() {
    setIsExporting(true);

    try {
      const params = financeFiltersToParams(appliedFilters);
      const result =
        variant === "admin" && dispatcherId
          ? await exportAdminDispatcherFinanceRequest(dispatcherId, params)
          : await exportDispatcherFinanceRequest(params);

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      setToastMessage("Finance report downloaded.");
    } catch (exportError) {
      setToastMessage(
        getErrorMessage(exportError, "Unable to export finance report."),
      );
    } finally {
      setIsExporting(false);
    }
  }

  const title =
    variant === "admin" && data
      ? `${data.profile.fullName} Finance`
      : "Finance Account";

  const description =
    variant === "admin"
      ? "Complete finance account for the selected dispatcher."
      : "Your earnings, dispatch fees, and load-level financial history.";

  return (
    <PageShell title={title} description={description}>
      {variant === "admin" && backHref ? (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 -ml-2 inline-flex",
          )}
        >
          <ArrowLeft className="size-4" />
          Back to Dispatchers
        </Link>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinanceExportButtons
              onExportCsv={handleExportCsv}
              onExportPdf={() => window.print()}
              isExporting={isExporting}
            />
          </div>
          <FinanceFilterBar
            values={draftFilters}
            filterOptions={data.filterOptions}
            onChange={setDraftFilters}
            onApply={() => setAppliedFilters(draftFilters)}
          />
        </>
      ) : null}

      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading finance data"
        errorTitle="Unable to load finance data"
        errorDescription={error ?? undefined}
        emptyTitle="No finance activity found"
        emptyDescription="No delivered or tracked load activity matches the selected filters."
      >
        {data ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {variant === "admin"
                    ? "Dispatcher Profile"
                    : "Personal Profile"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <ProfileField
                  label="Full Name"
                  value={data.profile.fullName}
                  emphasize
                />
                <ProfileField label="Email" value={data.profile.email} />
                <ProfileField
                  label="Phone"
                  value={data.profile.phoneNumber || "—"}
                />
                <ProfileField
                  label="Assigned Team"
                  value={data.profile.teamName}
                />
                <ProfileField label="Role" value={data.profile.role} />
                <div className="space-y-1">
                  <p className="text-muted-foreground">Status</p>
                  <StatusBadge status={data.profile.status} />
                </div>
                <ProfileField
                  label="Assigned Carriers"
                  value={data.profile.assignedCarriersCount.toLocaleString()}
                />
              </CardContent>
            </Card>

            {variant === "admin" && data.profile.assignedCarriers.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Carriers</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Truck Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.profile.assignedCarriers.map((carrier) => (
                        <TableRow key={carrier.id}>
                          <TableCell className="font-medium">
                            {carrier.carrierName}
                          </TableCell>
                          <TableCell>{carrier.driverName}</TableCell>
                          <TableCell>
                            {carrier.truckType.replaceAll("_", " ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Revenue (filtered period)"
                value={formatCurrency(data.summary.totalRevenue)}
              />
              <MetricCard
                label="Total Dispatch Fee (filtered period)"
                value={formatCurrency(data.summary.totalDispatchFee)}
              />
              <MetricCard
                label="Delivered Loads (filtered period)"
                value={data.summary.deliveredLoads.toLocaleString()}
              />
              <MetricCard
                label="Average Rate Per Mile"
                value={formatRatePerMile(data.summary.averageRatePerMile)}
              />
              <MetricCard
                label="Cancelled Loads"
                value={data.summary.cancelledLoads.toLocaleString()}
              />
              <MetricCard
                label="Not Booked"
                value={data.summary.notBookedCount.toLocaleString()}
              />
              <MetricCard
                label="Not Working"
                value={data.summary.notWorkingCount.toLocaleString()}
              />
              <MetricCard
                label="Booking Efficiency"
                value={formatPercent(data.summary.bookingEfficiency, 1, "0%")}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Earnings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Current Month Revenue (calendar month)
                      </p>
                      <p className="text-2xl font-semibold">
                        {formatCurrency(data.summary.currentMonthRevenue)}
                      </p>
                      {monthlyComparisonLabel ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {monthlyComparisonLabel}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Current Month Dispatch Fee (calendar month)
                      </p>
                      <p className="text-2xl font-semibold">
                        {formatCurrency(data.summary.currentMonthDispatchFee)}
                      </p>
                      {data.summary.monthOverMonthDispatchFeeChange !== null ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatGrowthLabel(
                            data.summary.monthOverMonthDispatchFeeChange,
                            "vs last month",
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Dispatch Fee</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.monthlyEarnings.map((month) => (
                        <TableRow key={month.monthKey}>
                          <TableCell>{month.monthLabel}</TableCell>
                          <TableCell>{formatCurrency(month.revenue)}</TableCell>
                          <TableCell>
                            {formatCurrency(month.dispatchFee)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Paid</span>
                    <Badge variant="secondary">
                      {formatCurrency(data.paymentTracking.paidAmount ?? 0)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      Pending (filtered period)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(data.paymentTracking.pendingAmount ?? 0)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {data.paymentTracking.message}
                  </p>
                </CardContent>
              </Card>
            </div>

            <FinanceCarrierTable rows={data.carrierBreakdown} />
            <FinanceLoadTable rows={data.loadHistory} />
          </div>
        ) : null}
      </PageContentGate>

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </PageShell>
  );
}

function ProfileField({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className={emphasize ? "text-base font-semibold" : "font-medium"}>
        {value}
      </p>
    </div>
  );
}
