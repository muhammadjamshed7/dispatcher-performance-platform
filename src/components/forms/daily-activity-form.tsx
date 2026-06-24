"use client";

import { useCallback, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useApiData } from "@/hooks/use-api-data";
import { fetchDispatchFeeRules } from "@/lib/api/resources";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import { DELIVERED, STATUSES } from "@/lib/constants/statuses";
import {
  getCarrierDisplayName,
  resolveCarrierLabel,
} from "@/lib/utils/carrier-display";
import { calculateDispatchFee } from "@/lib/utils/calculate-dispatch-fee";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";
import {
  dailyActivityFormSchema,
  defaultDailyActivityFormValues,
  type DailyActivityFormValues,
} from "@/lib/validation/daily-activity-form";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import { useRoleScope } from "@/hooks/use-role-scope";

type DailyActivityFormProps = {
  formId: string;
  defaultValues?: DailyActivityFormValues;
  readOnly?: boolean;
  allowedStatusReasons?: string[];
  carrierLabelFallback?: string;
  onSubmit: (values: DailyActivityFormValues) => void | Promise<void>;
};

export function DailyActivityForm({
  formId,
  defaultValues = defaultDailyActivityFormValues,
  readOnly = false,
  allowedStatusReasons = [],
  carrierLabelFallback = "",
  onSubmit,
}: DailyActivityFormProps) {
  const { filterCarriers } = useRoleScope();
  const { carriers: allCarriers, isLoading: carriersLoading } =
    useEntityOptions();
  const loadDispatchFeeRules = useCallback(() => fetchDispatchFeeRules(), []);
  const { data: dispatchFeeRules } = useApiData(loadDispatchFeeRules, []);
  const availableCarriers = useMemo(
    () => filterCarriers(allCarriers),
    [allCarriers, filterCarriers],
  );

  const resolvedDefaults = useMemo(
    () => ({
      ...defaultDailyActivityFormValues,
      ...defaultValues,
      carrierId: defaultValues.carrierId ?? "",
      reason: defaultValues.reason ?? "",
      notes: defaultValues.notes ?? "",
    }),
    [defaultValues],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<DailyActivityFormValues>({
    resolver: zodResolver(dailyActivityFormSchema),
    defaultValues: resolvedDefaults,
  });

  const status =
    useWatch({ control, name: "status" }) ??
    defaultDailyActivityFormValues.status;
  const carrierId = useWatch({ control, name: "carrierId" }) ?? "";
  const totalMiles = useWatch({ control, name: "totalMiles" });
  const loadAmount = useWatch({ control, name: "loadAmount" });
  const isDelivered = status === DELIVERED;

  const carrierSelectOptions = useMemo(() => {
    const options = availableCarriers.map((carrier) => ({
      id: carrier.id,
      label: getCarrierDisplayName(carrier),
    }));

    if (
      carrierId &&
      !options.some((option) => option.id === carrierId) &&
      carrierLabelFallback
    ) {
      options.unshift({ id: carrierId, label: carrierLabelFallback });
    }

    return options;
  }, [availableCarriers, carrierId, carrierLabelFallback]);

  const carrierLabelById = useMemo(
    () =>
      new Map(carrierSelectOptions.map((option) => [option.id, option.label])),
    [carrierSelectOptions],
  );

  const selectedCarrierLabel = useMemo(
    () =>
      resolveCarrierLabel(carrierId, carrierLabelById, carrierLabelFallback),
    [carrierId, carrierLabelById, carrierLabelFallback],
  );

  const carrierPlaceholder = carriersLoading
    ? "Loading carriers..."
    : "Select carrier";

  function handleStatusChange(nextStatus: DailyActivityFormValues["status"]) {
    setValue("status", nextStatus, { shouldValidate: true });

    if (nextStatus === DELIVERED) {
      setValue("reason", "");
      return;
    }

    setValue("origin", "");
    setValue("destination", "");
    setValue("totalMiles", undefined);
    setValue("loadAmount", undefined);
  }

  const parseOptionalNumber = (value: string | number) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const dispatchFeePercentage = useMemo(
    () =>
      availableCarriers.find((item) => item.id === carrierId)
        ?.dispatchFeePercentage ??
      dispatchFeeRules?.defaultPercentage ??
      0,
    [availableCarriers, carrierId, dispatchFeeRules?.defaultPercentage],
  );

  const calculatedRatePerMile = useMemo(() => {
    if (!isDelivered || !totalMiles || !loadAmount) {
      return 0;
    }

    return calculateRatePerMile(loadAmount, totalMiles);
  }, [isDelivered, totalMiles, loadAmount]);

  const calculatedDispatchFee = useMemo(() => {
    if (!isDelivered || !loadAmount) {
      return 0;
    }

    return calculateDispatchFee(loadAmount, dispatchFeePercentage, {
      minimumFee: dispatchFeeRules?.minimumFee,
      roundToNearestDollar: dispatchFeeRules?.roundToNearestDollar,
    });
  }, [
    dispatchFeePercentage,
    dispatchFeeRules?.minimumFee,
    dispatchFeeRules?.roundToNearestDollar,
    isDelivered,
    loadAmount,
  ]);

  useEffect(() => {
    reset(resolvedDefaults);
  }, [resolvedDefaults, reset]);

  return (
    <form
      id={formId}
      className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
      onSubmit={handleSubmit((values) => onSubmit(values))}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-date`}>Date</Label>
          <Input
            id={`${formId}-date`}
            type="date"
            disabled={readOnly}
            aria-invalid={Boolean(errors.date)}
            {...register("date")}
          />
          {errors.date ? (
            <p className="text-destructive text-sm">{errors.date.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-carrier`}>Carrier</Label>
          <Controller
            name="carrierId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ? field.value : null}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value);
                  }
                }}
                disabled={readOnly || carriersLoading}
              >
                <SelectTrigger id={`${formId}-carrier`} className="w-full">
                  <SelectValue placeholder={carrierPlaceholder}>
                    {selectedCarrierLabel || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {carrierSelectOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.carrierId ? (
            <p className="text-destructive text-sm">
              {errors.carrierId.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-status`}>Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (value) {
                  handleStatusChange(value as DailyActivityFormValues["status"]);
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger id={`${formId}-status`} className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {getLoadActivityStatusLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.status ? (
          <p className="text-destructive text-sm">{errors.status.message}</p>
        ) : null}
      </div>

      {isDelivered ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-origin`}>Origin</Label>
              <Input
                id={`${formId}-origin`}
                placeholder="City, ST"
                disabled={readOnly}
                aria-invalid={Boolean(errors.origin)}
                {...register("origin")}
              />
              {errors.origin ? (
                <p className="text-destructive text-sm">
                  {errors.origin.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-destination`}>Destination</Label>
              <Input
                id={`${formId}-destination`}
                placeholder="City, ST"
                disabled={readOnly}
                aria-invalid={Boolean(errors.destination)}
                {...register("destination")}
              />
              {errors.destination ? (
                <p className="text-destructive text-sm">
                  {errors.destination.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-total-miles`}>Total Miles</Label>
              <Input
                id={`${formId}-total-miles`}
                type="number"
                min={0}
                step="0.1"
                disabled={readOnly}
                aria-invalid={Boolean(errors.totalMiles)}
                {...register("totalMiles", { setValueAs: parseOptionalNumber })}
              />
              {errors.totalMiles ? (
                <p className="text-destructive text-sm">
                  {errors.totalMiles.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-load-amount`}>Load Amount</Label>
              <Input
                id={`${formId}-load-amount`}
                type="number"
                min={0}
                step="0.01"
                disabled={readOnly}
                aria-invalid={Boolean(errors.loadAmount)}
                {...register("loadAmount", { setValueAs: parseOptionalNumber })}
              />
              {errors.loadAmount ? (
                <p className="text-destructive text-sm">
                  {errors.loadAmount.message}
                </p>
              ) : null}
            </div>
          </div>

          <Card>
            <CardContent className="grid gap-2 py-4 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Rate Per Mile:</span>{" "}
                {formatRatePerMile(calculatedRatePerMile, "—")}
              </p>
              <p>
                <span className="text-muted-foreground">
                  Dispatch Fee Earned:
                </span>{" "}
                {formatCurrency(calculatedDispatchFee, { nullLabel: "—" })}
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-reason`}>Reason</Label>
          {allowedStatusReasons.length > 0 ? (
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? field.value : null}
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value);
                    }
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger id={`${formId}-reason`} className="w-full">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatusReasons.map((reasonOption) => (
                      <SelectItem key={reasonOption} value={reasonOption}>
                        {reasonOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No status reasons are configured. Ask an admin to add allowed
              reasons in Settings.
            </p>
          )}
          {errors.reason ? (
            <p className="text-destructive text-sm">{errors.reason.message}</p>
          ) : null}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${formId}-notes`}>Notes</Label>
        <Textarea
          id={`${formId}-notes`}
          placeholder="Optional notes"
          disabled={readOnly}
          {...register("notes")}
        />
      </div>
    </form>
  );
}
