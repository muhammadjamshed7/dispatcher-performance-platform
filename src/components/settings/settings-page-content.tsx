"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import { MockToast } from "@/components/feedback/mock-toast";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockAppSettings } from "@/lib/mock-data";

const SETTINGS_EDIT_MESSAGE = "Settings editing will be connected later.";

type SettingsSectionProps = {
  title: string;
  onEdit: () => void;
  children: ReactNode;
};

function SettingsSection({ title, onEdit, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export function SettingsPageContent() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const settings = mockAppSettings;

  const showEditToast = useCallback(() => {
    setToastMessage(SETTINGS_EDIT_MESSAGE);
  }, []);

  return (
    <>
      <PageShell
        title="Settings"
        description="Configure dispatch rules, allowed values, timezone, and export defaults. Mock values only — no backend persistence."
      >
        <RoleScopeBanner message="Settings preview uses mock values only" />

        <div className="grid gap-4 xl:grid-cols-2">
          <SettingsSection
            title="Dispatch Fee Calculation"
            onEdit={showEditToast}
          >
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

          <SettingsSection title="Allowed Truck Types" onEdit={showEditToast}>
            <div className="flex flex-wrap gap-2">
              {settings.allowedTruckTypes.map((truckType) => (
                <Badge key={truckType} variant="secondary">
                  {truckType.replaceAll("_", " ")}
                </Badge>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Allowed Status Reasons" onEdit={showEditToast}>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {settings.allowedStatusReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </SettingsSection>

          <SettingsSection title="Timezone" onEdit={showEditToast}>
            <p>
              <span className="text-muted-foreground">Default timezone:</span>{" "}
              {settings.timezone}
            </p>
          </SettingsSection>

          <SettingsSection
            title="CSV Export Settings"
            onEdit={showEditToast}
          >
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
      </PageShell>

      <MockToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
