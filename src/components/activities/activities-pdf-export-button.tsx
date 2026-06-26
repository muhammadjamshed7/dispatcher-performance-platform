"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActivityExcelFilterState } from "@/lib/filters/activity-excel-filter-params";
import type { EntityFilterValues } from "@/lib/filters/entity-filter-params";
import { exportDailyActivitiesPdf } from "@/lib/reports/export-daily-activities-pdf";
import { APPROVED } from "@/lib/constants/activity-approval";
import type { ActivitiesReportFilterContext } from "@/lib/reports/activities-report-filter-labels";
import type { Carrier, DailyActivity, Dispatcher, Team } from "@/lib/types";

type ActivitiesPdfExportButtonProps = {
  activities: DailyActivity[];
  compact: boolean;
  entityFilters: EntityFilterValues;
  excelFilters: ActivityExcelFilterState;
  teams: Team[];
  dispatchers: Dispatcher[];
  carriers: Carrier[];
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function ActivitiesPdfExportButton({
  activities,
  compact,
  entityFilters,
  excelFilters,
  teams,
  dispatchers,
  carriers,
  disabled = false,
  onSuccess,
  onError,
}: ActivitiesPdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    const approvedActivities = activities.filter(
      (activity) => activity.approvalStatus === APPROVED,
    );

    if (approvedActivities.length === 0) {
      onError?.("No approved activities to export for the current filters.");
      return;
    }

    const filterContext: ActivitiesReportFilterContext = {
      mode: compact ? "excel" : "entity",
      entityFilters,
      excelFilters,
      teams,
      dispatchers,
      carriers,
    };

    setIsExporting(true);

    try {
      await exportDailyActivitiesPdf({
        activities: approvedActivities,
        filterContext,
      });
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to export the activities PDF.";
      onError?.(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || isExporting || activities.length === 0}
      onClick={() => void handleExport()}
    >
      <FileText className="size-4" />
      {isExporting ? "Exporting PDF..." : "Export PDF"}
    </Button>
  );
}
