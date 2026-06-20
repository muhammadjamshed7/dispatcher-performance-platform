"use client";

import { useCallback, type ReactNode } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { fetchSettings } from "@/lib/api/resources";

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export function SettingsPageContent() {
  const loadSettings = useCallback(() => fetchSettings(), []);
  const { data: settings, error, isLoading, reload } = useApiData(loadSettings, []);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : settings
        ? "ready"
        : "empty";

  return (
    <PageShell
      title="Settings"
      description="Organization dispatch rules, allowed values, timezone, and export defaults."
    >
      <RoleScopeBanner message="Admin-only settings" />

      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading settings"
        emptyTitle="No settings found"
        emptyDescription="Application settings could not be found."
        errorTitle="Unable to load settings"
        errorDescription={
          error ?? "Settings could not be loaded. Try again in a moment."
        }
      >
        {settings ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <SettingsSection title="Dispatch Fee Calculation">
              <div className="space-y-2">
                <p>
                  <span className="text-muted-foreground">Method:</span>{" "}
                  {settings.dispatchFeeCalculation.method}
                </p>
                <p>
                  <span className="text-muted-foreground">Default percentage:</span>{" "}
                  {settings.dispatchFeeCalculation.defaultPercentage}%
                </p>
                <p>
                  <span className="text-muted-foreground">Minimum fee:</span> $
                  {settings.dispatchFeeCalculation.minimumFee.toLocaleString()}
                </p>
                <p>
                  <span className="text-muted-foreground">Round to nearest dollar:</span>{" "}
                  {settings.dispatchFeeCalculation.roundToNearestDollar ? "Yes" : "No"}
                </p>
              </div>
            </SettingsSection>

            <SettingsSection title="Allowed Truck Types">
              <div className="flex flex-wrap gap-2">
                {settings.allowedTruckTypes.map((truckType) => (
                  <Badge key={truckType} variant="secondary">
                    {truckType.replaceAll("_", " ")}
                  </Badge>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection title="Allowed Status Reasons">
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {settings.allowedStatusReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </SettingsSection>

            <SettingsSection title="Timezone">
              <p>
                <span className="text-muted-foreground">Default timezone:</span>{" "}
                {settings.timezone}
              </p>
            </SettingsSection>

            <SettingsSection title="CSV Export Settings">
              <div className="space-y-2">
                <p>
                  <span className="text-muted-foreground">Include headers:</span>{" "}
                  {settings.csvExport.includeHeaders ? "Yes" : "No"}
                </p>
                <p>
                  <span className="text-muted-foreground">Date format:</span>{" "}
                  {settings.csvExport.dateFormat}
                </p>
                <p>
                  <span className="text-muted-foreground">Max rows:</span>{" "}
                  {settings.csvExport.maxRows.toLocaleString()}
                </p>
                <p>
                  <span className="text-muted-foreground">File name prefix:</span>{" "}
                  {settings.csvExport.fileNamePrefix}
                </p>
              </div>
            </SettingsSection>
          </div>
        ) : null}
      </PageContentGate>
    </PageShell>
  );
}
