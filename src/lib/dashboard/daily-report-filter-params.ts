export function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type DailyReportFilterValues = {
  date: string;
  teamId: string;
  dispatcherId: string;
  status: string;
};

export function createDefaultDailyReportFilters(): DailyReportFilterValues {
  return {
    date: getTodayDateInputValue(),
    teamId: "all",
    dispatcherId: "all",
    status: "all",
  };
}

export function dailyReportFiltersToParams(
  filters: DailyReportFilterValues,
): Record<string, string> {
  const params: Record<string, string> = { date: filters.date };

  if (filters.teamId !== "all") {
    params.teamId = filters.teamId;
  }

  if (filters.dispatcherId !== "all") {
    params.dispatcherId = filters.dispatcherId;
  }

  if (filters.status !== "all") {
    params.status = filters.status;
  }

  return params;
}
