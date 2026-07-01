"use client";

import { useCallback, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleDollarSign, Gauge } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Card, CardContent } from "@/components/ui/card";
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

const fieldGroupClass = "space-y-2.5";
const fieldLabelClass = "text-base leading-none font-semibold text-foreground";
const fieldControlClass =
  "h-12 rounded-xl border-border/90 bg-background px-4 text-base shadow-sm placeholder:text-muted-foreground/90 focus-visible:ring-2 md:text-base";
const selectControlClass =
  "w-full rounded-xl border-border/90 bg-background px-4 text-base shadow-sm focus-visible:ring-2 data-[size=default]:h-12";
const textareaControlClass =
  "min-h-28 rounded-xl border-border/90 bg-background px-4 py-3 text-base shadow-sm placeholder:text-muted-foreground/90 focus-visible:ring-2 md:text-base";
const fieldErrorClass = "text-sm text-destructive";

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
    useEntityOptions({
      teams: false,
      dispatchers: false,
      carriers: true,
    });
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
      className="space-y-7"
      onSubmit={handleSubmit((values) => onSubmit(values))}
      noValidate
    >
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className={fieldGroupClass}>
          <Label className={fieldLabelClass} htmlFor={`${formId}-date`}>
            Date
          </Label>
          <Input
            id={`${formId}-date`}
            type="date"
            className={fieldControlClass}
            disabled={readOnly}
            aria-invalid={Boolean(errors.date)}
            {...register("date")}
          />
          {errors.date ? (
            <p className={fieldErrorClass}>{errors.date.message}</p>
          ) : null}
        </div>

        <div className={fieldGroupClass}>
          <Label className={fieldLabelClass} htmlFor={`${formId}-carrier`}>
            Carrier
          </Label>
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
                <SelectTrigger
                  id={`${formId}-carrier`}
                  className={selectControlClass}
                >
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
            <p className={fieldErrorClass}>{errors.carrierId.message}</p>
          ) : null}
        </div>
      </div>

      <div className={fieldGroupClass}>
        <Label className={fieldLabelClass} htmlFor={`${formId}-status`}>
          Status
        </Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (value) {
                  handleStatusChange(
                    value as DailyActivityFormValues["status"],
                  );
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger
                id={`${formId}-status`}
                className={selectControlClass}
              >
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
          <p className={fieldErrorClass}>{errors.status.message}</p>
        ) : null}
      </div>

      {isDelivered ? (
        <>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className={fieldGroupClass}>
              <Label className={fieldLabelClass} htmlFor={`${formId}-origin`}>
                Origin
              </Label>
              <Input
                id={`${formId}-origin`}
                placeholder="City, ST"
                className={fieldControlClass}
                disabled={readOnly}
                aria-invalid={Boolean(errors.origin)}
                {...register("origin")}
              />
              {errors.origin ? (
                <p className={fieldErrorClass}>{errors.origin.message}</p>
              ) : null}
            </div>

            <div className={fieldGroupClass}>
              <Label
                className={fieldLabelClass}
                htmlFor={`${formId}-destination`}
              >
                Destination
              </Label>
              <Input
                id={`${formId}-destination`}
                placeholder="City, ST"
                className={fieldControlClass}
                disabled={readOnly}
                aria-invalid={Boolean(errors.destination)}
                {...register("destination")}
              />
              {errors.destination ? (
                <p className={fieldErrorClass}>{errors.destination.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className={fieldGroupClass}>
              <Label
                className={fieldLabelClass}
                htmlFor={`${formId}-total-miles`}
              >
                Total Miles
              </Label>
              <Input
                id={`${formId}-total-miles`}
                type="number"
                min={0}
                step="0.1"
                className={fieldControlClass}
                disabled={readOnly}
                aria-invalid={Boolean(errors.totalMiles)}
                {...register("totalMiles", { setValueAs: parseOptionalNumber })}
              />
              {errors.totalMiles ? (
                <p className={fieldErrorClass}>{errors.totalMiles.message}</p>
              ) : null}
            </div>

            <div className={fieldGroupClass}>
              <Label
                className={fieldLabelClass}
                htmlFor={`${formId}-load-amount`}
              >
                Load Amount
              </Label>
              <Input
                id={`${formId}-load-amount`}
                type="number"
                min={0}
                step="0.01"
                className={fieldControlClass}
                disabled={readOnly}
                aria-invalid={Boolean(errors.loadAmount)}
                {...register("loadAmount", { setValueAs: parseOptionalNumber })}
              />
              {errors.loadAmount ? (
                <p className={fieldErrorClass}>{errors.loadAmount.message}</p>
              ) : null}
            </div>
          </div>

          <Card className="border-border/90 bg-muted/30 rounded-xl border py-0 shadow-none ring-0">
            <CardContent className="grid gap-0 p-0 sm:grid-cols-2">
              <div className="flex items-center gap-4 p-5 sm:p-6">
                <span className="bg-background text-foreground ring-border/80 flex size-14 shrink-0 items-center justify-center rounded-full shadow-sm ring-1">
                  <Gauge className="size-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm font-medium">
                    Rate Per Mile
                  </p>
                  <p className="text-foreground mt-1 text-3xl leading-none font-semibold whitespace-nowrap">
                    {formatRatePerMile(calculatedRatePerMile, "-")}
                  </p>
                </div>
              </div>

              <div className="border-border/80 flex items-center gap-4 border-t p-5 sm:border-t-0 sm:border-l sm:p-6">
                <span className="bg-background text-foreground ring-border/80 flex size-14 shrink-0 items-center justify-center rounded-full shadow-sm ring-1">
                  <CircleDollarSign className="size-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm font-medium">
                    Dispatch Fee Earned
                  </p>
                  <p className="text-foreground mt-1 text-3xl leading-none font-semibold whitespace-nowrap">
                    {formatCurrency(calculatedDispatchFee, { nullLabel: "-" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className={fieldGroupClass}>
          <Label className={fieldLabelClass} htmlFor={`${formId}-reason`}>
            Reason
          </Label>
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
                  <SelectTrigger
                    id={`${formId}-reason`}
                    className={selectControlClass}
                  >
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
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No status reasons are configured. Ask an admin to add allowed
              reasons in Settings.
            </p>
          )}
          {errors.reason ? (
            <p className={fieldErrorClass}>{errors.reason.message}</p>
          ) : null}
        </div>
      )}

      <div className={fieldGroupClass}>
        <Label className={fieldLabelClass} htmlFor={`${formId}-notes`}>
          Notes
        </Label>
        <Textarea
          id={`${formId}-notes`}
          placeholder="Optional notes"
          className={textareaControlClass}
          disabled={readOnly}
          {...register("notes")}
        />
      </div>
    </form>
  );
}
