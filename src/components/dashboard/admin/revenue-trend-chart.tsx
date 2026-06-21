"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
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

type RevenueTrendChartProps = {
  data: { date: string; revenue: number }[];
};

function formatAxis(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value}`;
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const maxRevenue = data.reduce((max, point) => Math.max(max, point.revenue), 0);
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.1) : 100;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, "min-h-[380px]")}>
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h3 className="truncate text-base font-semibold text-[#0F172A]">
          Revenue Trend
        </h3>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569]"
        >
          Daily
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div className="mb-3 shrink-0 text-xs text-[#64748B]">Revenue (USD)</div>
      <div className={DASHBOARD_CHART_BODY_CLASS}>
        {data.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
                  <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748B", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
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
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2563EB"
                strokeWidth={3}
                fill="url(#revenueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
