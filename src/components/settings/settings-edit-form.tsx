"use client";

import { useMemo, useState } from "react";

import { AppToast } from "@/components/feedback/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/client";
import { updateSettingsRequest } from "@/lib/api/resources";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import type { AppSettings, TruckType } from "@/lib/types";
import { setDefaultCurrency } from "@/lib/utils/format-currency";

type SettingsEditFormProps = {
  settings: AppSettings;
  onSaved: () => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export function SettingsEditForm({ settings, onSaved }: SettingsEditFormProps) {
  const [dispatchFeeMethod, setDispatchFeeMethod] = useState(
    settings.dispatchFeeCalculation.method,
  );
  const [defaultPercentage, setDefaultPercentage] = useState(
    String(settings.dispatchFeeCalculation.defaultPercentage),
  );
  const [minimumFee, setMinimumFee] = useState(
    String(settings.dispatchFeeCalculation.minimumFee),
  );
  const [roundToNearestDollar, setRoundToNearestDollar] = useState(
    settings.dispatchFeeCalculation.roundToNearestDollar,
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState(settings.currency);
  const [allowedTruckTypes, setAllowedTruckTypes] = useState<TruckType[]>(
    settings.allowedTruckTypes,
  );
  const [allowedStatusReasons, setAllowedStatusReasons] = useState(
    settings.allowedStatusReasons.join("\n"),
  );
  const [csvIncludeHeaders, setCsvIncludeHeaders] = useState(
    settings.csvExport.includeHeaders,
  );
  const [csvDateFormat, setCsvDateFormat] = useState(
    settings.csvExport.dateFormat,
  );
  const [csvMaxRows, setCsvMaxRows] = useState(
    String(settings.csvExport.maxRows),
  );
  const [csvFileNamePrefix, setCsvFileNamePrefix] = useState(
    settings.csvExport.fileNamePrefix,
  );
  const [directAdminApprovalMode, setDirectAdminApprovalMode] = useState(
    settings.directAdminApprovalMode,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const truckTypeOptions = useMemo(
    () =>
      TRUCK_TYPES.map((type) => ({
        value: type,
        label: type.replaceAll("_", " "),
      })),
    [],
  );

  function toggleTruckType(type: TruckType) {
    setAllowedTruckTypes((current) =>
      current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type],
    );
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const savedSettings = await updateSettingsRequest({
        dispatchFeeMethod,
        defaultDispatchFeePercent: Number(defaultPercentage),
        minimumDispatchFee: Number(minimumFee),
        roundToNearestDollar,
        allowedTruckTypes,
        timezone,
        currency,
        allowedStatusReasons: allowedStatusReasons
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        csvIncludeHeaders,
        csvDateFormat,
        csvMaxRows: Number(csvMaxRows),
        csvFileNamePrefix,
        directAdminApprovalMode,
      });
      setDefaultCurrency(savedSettings.currency);
      setToastMessage("Settings saved.");
      await onSaved();
    } catch (error) {
      setToastMessage(getErrorMessage(error, "Failed to save settings."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dispatch Fee Calculation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dispatch-fee-method">Method</Label>
              <Input
                id="dispatch-fee-method"
                value={dispatchFeeMethod}
                onChange={(event) => setDispatchFeeMethod(event.target.value)}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-percentage">Default percentage</Label>
              <Input
                id="default-percentage"
                type="number"
                min={0}
                max={100}
                value={defaultPercentage}
                onChange={(event) => setDefaultPercentage(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum-fee">Minimum fee</Label>
              <Input
                id="minimum-fee"
                type="number"
                min={0}
                value={minimumFee}
                onChange={(event) => setMinimumFee(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={roundToNearestDollar}
                onChange={(event) =>
                  setRoundToNearestDollar(event.target.checked)
                }
              />
              Round to nearest dollar
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allowed Truck Types</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {truckTypeOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={allowedTruckTypes.includes(option.value)}
                  onChange={() => toggleTruckType(option.value)}
                />
                {option.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allowed Status Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={allowedStatusReasons}
              onChange={(event) => setAllowedStatusReasons(event.target.value)}
              rows={8}
              placeholder="One reason per line"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timezone & CSV Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                maxLength={3}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
                placeholder="USD"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={csvIncludeHeaders}
                onChange={(event) => setCsvIncludeHeaders(event.target.checked)}
              />
              Include CSV headers
            </label>
            <div className="space-y-2">
              <Label htmlFor="csv-date-format">CSV date format</Label>
              <Input
                id="csv-date-format"
                value={csvDateFormat}
                onChange={(event) => setCsvDateFormat(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-max-rows">CSV max rows</Label>
              <Input
                id="csv-max-rows"
                type="number"
                min={1}
                value={csvMaxRows}
                onChange={(event) => setCsvMaxRows(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-prefix">CSV file name prefix</Label>
              <Input
                id="csv-prefix"
                value={csvFileNamePrefix}
                onChange={(event) => setCsvFileNamePrefix(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={directAdminApprovalMode}
                onChange={(event) =>
                  setDirectAdminApprovalMode(event.target.checked)
                }
              />
              <span>
                Direct admin approval mode — dispatcher submissions skip team
                lead review and go straight to admin approval.
              </span>
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}
