"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";

import { LoadingState } from "@/components/feedback/loading-state";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { fetchDispatcherFinance } from "@/lib/api/resources";
import { FILTER_ALL } from "@/lib/constants/filters";
import { financeFiltersToParams } from "@/lib/dashboard/finance-filter-params";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DispatcherAccountFinanceSummary() {
  const loadFinance = () =>
    fetchDispatcherFinance(
      financeFiltersToParams({
        dateRange: "this-month",
        dateFrom: "",
        dateTo: "",
        carrierId: FILTER_ALL,
        status: FILTER_ALL,
      }),
    );

  const { data, error, isLoading } = useApiData(loadFinance, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-primary/10 flex size-10 items-center justify-center rounded-full">
          <DollarSign className="text-primary size-5" />
        </div>
        <div>
          <CardTitle className="text-base">Finance Summary</CardTitle>
          <p className="text-muted-foreground text-sm">
            Current month earnings and dispatch fees.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <LoadingState title="Loading finance summary" rows={2} />
        ) : error ? (
          <p className="text-destructive text-sm">
            Unable to load finance summary.
          </p>
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Current Month Revenue"
                value={formatCurrency(data.summary.currentMonthRevenue)}
              />
              <MetricCard
                label="Current Month Dispatch Fee"
                value={formatCurrency(data.summary.currentMonthDispatchFee)}
              />
              <MetricCard
                label="Delivered Loads"
                value={data.summary.deliveredLoads.toLocaleString()}
              />
              <MetricCard
                label="Average Rate Per Mile"
                value={formatRatePerMile(data.summary.averageRatePerMile)}
              />
            </div>
            <Link
              href="/dispatcher/finance"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              View full finance account
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
