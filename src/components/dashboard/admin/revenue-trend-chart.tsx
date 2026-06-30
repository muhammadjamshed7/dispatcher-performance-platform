"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChevronDown } from "lucide-react";

import {
  DASHBOARD_CHART_BODY_CLASS,
  DASHBOARD_CHART_CARD_CLASS,
  DASHBOARD_EMPTY_STATE_CLASS,
} from "@/components/dashboard/admin/dashboard-chart-styles";
import { cn } from "@/lib/utils";

type RevenueComparisonPoint = {
  label: string;
  group: "Dispatcher" | "Team";
  revenue: number;
};

type RevenueTrendChartProps = {
  data: RevenueComparisonPoint[];
};

function formatAxis(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value}`;
}

function formatLabel(value: string) {
  return value.length > 14 ? `${value.slice(0, 13)}...` : value;
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const maxRevenue = data.reduce(
    (max, point) => Math.max(max, point.revenue),
    0,
  );
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.15) : 100;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, "min-h-[380px]")}>
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h3 className="truncate text-base font-semibold text-[#0F172A]">
            Revenue Comparison
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Dispatcher and team revenue for the selected period
          </p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569]"
        >
          Selected period
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div className="mb-3 shrink-0 text-xs text-[#64748B]">Revenue (USD)</div>
      <div className={DASHBOARD_CHART_BODY_CLASS}>
        {data.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>No revenue data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 14 }}
            >
              <CartesianGrid
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickFormatter={formatLabel}
                tick={{ fill: "#64748B", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tickFormatter={formatAxis}
                tick={{ fill: "#64748B", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={48}
                domain={[0, yMax]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                }}
                formatter={(value) => [formatAxis(Number(value)), "Revenue"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as
                    | RevenueComparisonPoint
                    | undefined;
                  return row ? `${row.group}: ${row.label}` : "";
                }}
              />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]} maxBarSize={48}>
                {data.map((entry) => (
                  <Cell
                    key={`${entry.group}-${entry.label}`}
                    fill={entry.group === "Dispatcher" ? "#2563EB" : "#14B8A6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
