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

import {
  DASHBOARD_CHART_BODY_CLASS,
  DASHBOARD_CHART_CARD_CLASS,
} from "@/components/dashboard/admin/dashboard-chart-styles";
import { cn } from "@/lib/utils";

type PersonalRevenueTrendChartProps = {
  data: { date: string; revenue: number }[];
};

function formatAxis(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value}`;
}

export function PersonalRevenueTrendChart({
  data,
}: PersonalRevenueTrendChartProps) {
  const maxRevenue = data.reduce(
    (max, point) => Math.max(max, point.revenue),
    0,
  );
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.1) : 100;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, "min-h-[360px]")}>
      <div className="mb-4 shrink-0">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Personal Revenue Trend
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Delivered revenue over selected period
        </p>
      </div>
      <div className={DASHBOARD_CHART_BODY_CLASS}>
        {data.length === 0 ? (
          <div className="flex h-full min-h-[280px] w-full items-center justify-center text-sm text-[#64748B]">
            No delivered revenue data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="dispatcherRevenueFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
                  <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                vertical={false}
              />
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
                fill="url(#dispatcherRevenueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
