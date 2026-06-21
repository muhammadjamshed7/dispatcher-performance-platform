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

import { ChevronDown } from "lucide-react";

import {
  DASHBOARD_CHART_BODY_CLASS,
  DASHBOARD_CHART_CARD_CLASS,
  DASHBOARD_EMPTY_STATE_CLASS,
} from "@/components/dashboard/admin/dashboard-chart-styles";
import { cn } from "@/lib/utils";

type LoadsByTeamChartProps = {
  data: { team: string; loads: number }[];
};

export function LoadsByTeamChart({ data }: LoadsByTeamChartProps) {
  const maxLoads = data.reduce((max, point) => Math.max(max, point.loads), 0);
  const yMax = maxLoads > 0 ? Math.ceil(maxLoads * 1.1) : 10;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, "min-h-[380px]")}>
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h3 className="truncate text-base font-semibold text-[#0F172A]">
          Loads by Team
        </h3>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569]"
        >
          This Month
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div className={DASHBOARD_CHART_BODY_CLASS}>
        {data.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
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
              <Bar dataKey="loads" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
