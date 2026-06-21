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

type LoadsByTeamChartProps = {
  data: { team: string; loads: number }[];
};

export function LoadsByTeamChart({ data }: LoadsByTeamChartProps) {
  const maxLoads = data.reduce((max, point) => Math.max(max, point.loads), 0);
  const yMax = maxLoads > 0 ? Math.ceil(maxLoads * 1.1) : 10;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] xl:col-span-2">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#0F172A]">Loads by Team</h3>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569]"
        >
          This Month
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div className="h-[260px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[#64748B]">
            No data available
          </div>
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
