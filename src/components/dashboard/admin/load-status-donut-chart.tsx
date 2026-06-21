"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type LoadStatusDonutChartProps = {
  data: { name: string; value: number; percent: string; color: string }[];
  totalLoads: number;
};

export function LoadStatusDonutChart({
  data,
  totalLoads,
}: LoadStatusDonutChartProps) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] xl:col-span-1">
      <h3 className="mb-5 text-base font-semibold text-[#0F172A]">
        Load Status Breakdown
      </h3>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="relative mx-auto h-[220px] w-full max-w-[220px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[#64748B]">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={88}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-semibold text-[#0F172A]">{totalLoads}</p>
            <p className="text-xs text-[#64748B]">Total Loads</p>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {data.length === 0 ? (
            <p className="text-sm text-[#64748B]">No data available</p>
          ) : (
            data.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-[#475569]">{item.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-medium text-[#0F172A]">{item.value}</span>
                  <span className="ml-2 text-[#64748B]">{item.percent}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
