"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  DASHBOARD_CHART_BODY_CLASS,
  DASHBOARD_CHART_CARD_CLASS,
  DASHBOARD_EMPTY_STATE_CLASS,
} from "@/components/dashboard/admin/dashboard-chart-styles";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type TeamComparisonChartProps = {
  data: { team: string; deliveredLoads: number }[];
};

export function TeamComparisonChart({ data }: TeamComparisonChartProps) {
  const chartData = data.map((point) => ({
    team: point.team,
    loads: point.deliveredLoads,
  }));
  const maxLoads = chartData.reduce(
    (max, point) => Math.max(max, point.loads),
    0,
  );
  const yMax = maxLoads > 0 ? Math.ceil(maxLoads * 1.1) : 10;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, "min-h-[380px]")}>
      <h3 className="mb-4 shrink-0 text-base font-semibold text-[#0F172A]">
        Team Comparison
      </h3>
      <p className="mb-4 shrink-0 text-sm text-[#64748B]">
        Delivered loads by team
      </p>
      <div className={DASHBOARD_CHART_BODY_CLASS}>
        {chartData.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="team"
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, yMax]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                }}
              />
              <Bar dataKey="loads" fill="#2563EB" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

type RevenueByTeamChartProps = {
  data: { team: string; revenue: number }[];
};

export function RevenueByTeamChart({ data }: RevenueByTeamChartProps) {
  const maxRevenue = data.reduce(
    (max, point) => Math.max(max, point.revenue),
    0,
  );
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.1) : 1000;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, "min-h-[380px]")}>
      <h3 className="mb-4 shrink-0 text-base font-semibold text-[#0F172A]">
        Revenue by Team
      </h3>
      <p className="mb-4 shrink-0 text-sm text-[#64748B]">
        Delivered load revenue by team
      </p>
      <div className={DASHBOARD_CHART_BODY_CLASS}>
        {data.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="team"
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={[0, yMax]}
                tickFormatter={(value) => formatCurrencyCompact(value, "$0")}
              />
              <Tooltip
                formatter={(value) => formatCurrencyCompact(Number(value))}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                }}
              />
              <Bar dataKey="revenue" fill="#22C55E" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
