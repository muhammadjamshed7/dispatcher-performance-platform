"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
import {
  DELIVERED,
  STATUSES,
} from "@/lib/constants/statuses";
import { mockCarriers } from "@/lib/mock-data";
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
  onSubmit: (values: DailyActivityFormValues) => void;
};

export function DailyActivityForm({
  formId,
  defaultValues = defaultDailyActivityFormValues,
  readOnly = false,
  onSubmit,
}: DailyActivityFormProps) {
  const { filterCarriers } = useRoleScope();
  const availableCarriers = useMemo(
    () => filterCarriers(mockCarriers),
    [filterCarriers],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DailyActivityFormValues>({
    resolver: zodResolver(dailyActivityFormSchema),
    defaultValues,
  });

  const status = watch("status");
  const carrier = watch("carrier");
  const totalMiles = watch("totalMiles");
  const loadAmount = watch("loadAmount");
  const isDelivered = status === DELIVERED;

  const dispatchFeePercentage = useMemo(
    () =>
      availableCarriers.find((item) => item.carrierName === carrier)
        ?.dispatchFeePercentage ?? 0,
    [availableCarriers, carrier],
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

    return calculateDispatchFee(loadAmount, dispatchFeePercentage);
  }, [isDelivered, loadAmount, dispatchFeePercentage]);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form
      id={formId}
      className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
      onSubmit={handleSubmit(onSubmit)}
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
            <p className="text-sm text-destructive">{errors.date.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-carrier`}>Carrier</Label>
          <Select
            value={carrier}
            onValueChange={(value) => {
              if (value) {
                setValue("carrier", value, { shouldValidate: true });
              }
            }}
            disabled={readOnly}
          >
            <SelectTrigger id={`${formId}-carrier`} className="w-full">
              <SelectValue placeholder="Select carrier" />
            </SelectTrigger>
            <SelectContent>
              {availableCarriers.map((item) => (
                <SelectItem key={item.id} value={item.carrierName}>
                  {item.carrierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.carrier ? (
            <p className="text-sm text-destructive">{errors.carrier.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-status`}>Status</Label>
        <Select
          value={status}
          onValueChange={(value) => {
            if (value) {
              setValue("status", value as DailyActivityFormValues["status"], {
                shouldValidate: true,
              });
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
                {item.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.status ? (
          <p className="text-sm text-destructive">{errors.status.message}</p>
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
                <p className="text-sm text-destructive">{errors.origin.message}</p>
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
                <p className="text-sm text-destructive">
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
                {...register("totalMiles", { valueAsNumber: true })}
              />
              {errors.totalMiles ? (
                <p className="text-sm text-destructive">
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
                {...register("loadAmount", { valueAsNumber: true })}
              />
              {errors.loadAmount ? (
                <p className="text-sm text-destructive">
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
                <span className="text-muted-foreground">Dispatch Fee Earned:</span>{" "}
                {formatCurrency(calculatedDispatchFee, { nullLabel: "—" })}
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-reason`}>Reason</Label>
          <Textarea
            id={`${formId}-reason`}
            placeholder="Enter reason"
            disabled={readOnly}
            aria-invalid={Boolean(errors.reason)}
            {...register("reason")}
          />
          {errors.reason ? (
            <p className="text-sm text-destructive">{errors.reason.message}</p>
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
