"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

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
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { cn } from "@/lib/utils";
import {
  carrierFormSchema,
  defaultCarrierFormValues,
  type CarrierFormValues,
} from "@/lib/validation/carrier-form";

type CarrierFormProps = {
  formId: string;
  defaultValues?: CarrierFormValues;
  readOnly?: boolean;
  variant?: "default" | "premium";
  onSubmit: (values: CarrierFormValues) => void;
};

const premiumLabelClass = "mb-2 block text-sm font-semibold text-[#0F172A]";
const premiumErrorClass = "mt-1.5 text-xs text-[#DC2626]";
const premiumInputClass =
  "h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] shadow-none focus-visible:border-[#2563EB] focus-visible:ring-[3px] focus-visible:ring-[rgba(37,99,235,0.12)] aria-invalid:border-[#EF4444] aria-invalid:ring-[3px] aria-invalid:ring-[rgba(239,68,68,0.12)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]";
const premiumSelectTriggerClass =
  "h-12 w-full rounded-xl border-[#CBD5E1] bg-white px-4 text-[15px] text-[#0F172A] shadow-none focus-visible:border-[#2563EB] focus-visible:ring-[3px] focus-visible:ring-[rgba(37,99,235,0.12)] aria-invalid:border-[#EF4444] aria-invalid:ring-[3px] aria-invalid:ring-[rgba(239,68,68,0.12)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] data-placeholder:text-[#94A3B8]";
const premiumTextareaClass =
  "min-h-[120px] resize-y rounded-xl border-[#CBD5E1] bg-white px-4 py-3.5 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] shadow-none focus-visible:border-[#2563EB] focus-visible:ring-[3px] focus-visible:ring-[rgba(37,99,235,0.12)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]";
const premiumNumberInputClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const modalSelectContentProps = {
  alignItemWithTrigger: false as const,
  side: "bottom" as const,
  className: "max-h-60",
};

function FieldLabel({
  htmlFor,
  children,
  premium,
}: {
  htmlFor: string;
  children: ReactNode;
  premium: boolean;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className={premium ? premiumLabelClass : undefined}
    >
      {children}
    </Label>
  );
}

function FieldError({
  message,
  premium,
}: {
  message?: string;
  premium: boolean;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className={premium ? premiumErrorClass : "text-destructive text-sm"}>
      {message}
    </p>
  );
}

export function CarrierForm({
  formId,
  defaultValues,
  readOnly = false,
  variant = "default",
  onSubmit,
}: CarrierFormProps) {
  const isCreateMode = defaultValues === undefined;
  const initialValues = defaultValues ?? defaultCarrierFormValues;
  const premium = variant === "premium";
  const { teams, dispatchers, isLoading } = useEntityOptions();
  const loadDispatchFeeRules = useCallback(() => fetchDispatchFeeRules(), []);
  const { data: dispatchFeeRules } = useApiData(loadDispatchFeeRules, [], {
    enabled: isCreateMode && !readOnly,
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { dirtyFields, errors },
  } = useForm<CarrierFormValues>({
    resolver: zodResolver(carrierFormSchema),
    defaultValues: initialValues,
  });

  const truckType = useWatch({ control, name: "truckType" });
  const assignedTeam = useWatch({ control, name: "assignedTeam" });
  const assignedDispatcher = useWatch({ control, name: "assignedDispatcher" });
  const status = useWatch({ control, name: "status" });

  const teamDispatchers = useMemo(
    () =>
      dispatchers.filter((dispatcher) => dispatcher.teamName === assignedTeam),
    [assignedTeam, dispatchers],
  );

  const dispatcherPlaceholder = isLoading
    ? "Loading dispatchers..."
    : !assignedTeam
      ? "Select team first"
      : teamDispatchers.length === 0
        ? "No dispatchers in this team"
        : "Select dispatcher";

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    if (
      isCreateMode &&
      dispatchFeeRules &&
      !dirtyFields.dispatchFeePercentage
    ) {
      setValue("dispatchFeePercentage", dispatchFeeRules.defaultPercentage);
    }
  }, [
    dirtyFields.dispatchFeePercentage,
    dispatchFeeRules,
    isCreateMode,
    setValue,
  ]);

  useEffect(() => {
    if (
      assignedTeam &&
      assignedDispatcher &&
      !teamDispatchers.some(
        (dispatcher) => dispatcher.fullName === assignedDispatcher,
      )
    ) {
      setValue("assignedDispatcher", "");
    }
  }, [assignedTeam, assignedDispatcher, teamDispatchers, setValue]);

  return (
    <form
      id={formId}
      className={cn(
        premium
          ? "grid grid-cols-1 gap-x-6 gap-y-[22px] md:grid-cols-2"
          : "max-h-[60vh] space-y-4 overflow-y-auto pr-1",
      )}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      {premium ? (
        <>
          <div className="space-y-0">
            <FieldLabel htmlFor={`${formId}-carrier-name`} premium={premium}>
              Carrier Name
            </FieldLabel>
            <Input
              id={`${formId}-carrier-name`}
              placeholder="Enter carrier name"
              disabled={readOnly}
              aria-invalid={Boolean(errors.carrierName)}
              className={premiumInputClass}
              {...register("carrierName")}
            />
            <FieldError
              message={errors.carrierName?.message}
              premium={premium}
            />
          </div>

          <div className="space-y-0">
            <FieldLabel htmlFor={`${formId}-driver-name`} premium={premium}>
              Driver Name
            </FieldLabel>
            <Input
              id={`${formId}-driver-name`}
              placeholder="Enter driver name"
              disabled={readOnly}
              aria-invalid={Boolean(errors.driverName)}
              className={premiumInputClass}
              {...register("driverName")}
            />
            <FieldError
              message={errors.driverName?.message}
              premium={premium}
            />
          </div>

          <div className="space-y-0">
            <FieldLabel htmlFor={`${formId}-mc-number`} premium={premium}>
              MC Number
            </FieldLabel>
            <Input
              id={`${formId}-mc-number`}
              placeholder="MC-000000"
              disabled={readOnly}
              aria-invalid={Boolean(errors.mcNumber)}
              className={premiumInputClass}
              {...register("mcNumber")}
            />
            <FieldError message={errors.mcNumber?.message} premium={premium} />
          </div>

          <div className="space-y-0">
            <FieldLabel htmlFor={`${formId}-dispatch-fee`} premium={premium}>
              Dispatch Fee Percentage
            </FieldLabel>
            <div className="relative">
              <Input
                id={`${formId}-dispatch-fee`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                disabled={readOnly}
                aria-invalid={Boolean(errors.dispatchFeePercentage)}
                className={cn(
                  premiumInputClass,
                  "pr-10",
                  premiumNumberInputClass,
                )}
                {...register("dispatchFeePercentage", { valueAsNumber: true })}
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-[#64748B]">
                %
              </span>
            </div>
            <FieldError
              message={errors.dispatchFeePercentage?.message}
              premium={premium}
            />
          </div>

          <div className="space-y-0 md:col-span-2">
            <FieldLabel htmlFor={`${formId}-truck-type`} premium={premium}>
              Truck Type
            </FieldLabel>
            <Select
              value={truckType}
              onValueChange={(value) => {
                if (value) {
                  setValue(
                    "truckType",
                    value as CarrierFormValues["truckType"],
                    {
                      shouldValidate: true,
                    },
                  );
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger
                id={`${formId}-truck-type`}
                className={premiumSelectTriggerClass}
              >
                <SelectValue placeholder="Select truck type" />
              </SelectTrigger>
              <SelectContent>
                {TRUCK_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.truckType?.message} premium={premium} />
          </div>

          <div className="space-y-0">
            <FieldLabel htmlFor={`${formId}-assigned-team`} premium={premium}>
              Assigned Team
            </FieldLabel>
            <Select
              value={assignedTeam}
              onValueChange={(value) => {
                if (value) {
                  setValue("assignedTeam", value, { shouldValidate: true });
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger
                id={`${formId}-assigned-team`}
                className={premiumSelectTriggerClass}
              >
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.name}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError
              message={errors.assignedTeam?.message}
              premium={premium}
            />
          </div>

          <div className="space-y-0">
            <FieldLabel
              htmlFor={`${formId}-assigned-dispatcher`}
              premium={premium}
            >
              Assigned Dispatcher
            </FieldLabel>
            <Select
              value={assignedDispatcher}
              onValueChange={(value) => {
                if (value) {
                  setValue("assignedDispatcher", value, {
                    shouldValidate: true,
                  });
                }
              }}
              disabled={readOnly || !assignedTeam || isLoading}
            >
              <SelectTrigger
                id={`${formId}-assigned-dispatcher`}
                className={premiumSelectTriggerClass}
              >
                <SelectValue placeholder={dispatcherPlaceholder} />
              </SelectTrigger>
              <SelectContent {...modalSelectContentProps}>
                {teamDispatchers.map((dispatcher) => (
                  <SelectItem key={dispatcher.id} value={dispatcher.fullName}>
                    {dispatcher.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError
              message={errors.assignedDispatcher?.message}
              premium={premium}
            />
          </div>

          <div className="space-y-0 md:col-span-2">
            <FieldLabel htmlFor={`${formId}-status`} premium={premium}>
              Status
            </FieldLabel>
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) {
                  setValue("status", value as CarrierFormValues["status"], {
                    shouldValidate: true,
                  });
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger
                id={`${formId}-status`}
                className={premiumSelectTriggerClass}
              >
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.status?.message} premium={premium} />
          </div>

          <div className="space-y-0 md:col-span-2">
            <FieldLabel htmlFor={`${formId}-notes`} premium={premium}>
              Notes
            </FieldLabel>
            <Textarea
              id={`${formId}-notes`}
              placeholder="Optional notes"
              disabled={readOnly}
              className={premiumTextareaClass}
              {...register("notes")}
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-carrier-name`} premium={premium}>
                Carrier Name
              </FieldLabel>
              <Input
                id={`${formId}-carrier-name`}
                placeholder="Enter carrier name"
                disabled={readOnly}
                aria-invalid={Boolean(errors.carrierName)}
                {...register("carrierName")}
              />
              <FieldError
                message={errors.carrierName?.message}
                premium={premium}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-driver-name`} premium={premium}>
                Driver Name
              </FieldLabel>
              <Input
                id={`${formId}-driver-name`}
                placeholder="Enter driver name"
                disabled={readOnly}
                aria-invalid={Boolean(errors.driverName)}
                {...register("driverName")}
              />
              <FieldError
                message={errors.driverName?.message}
                premium={premium}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-mc-number`} premium={premium}>
                MC Number
              </FieldLabel>
              <Input
                id={`${formId}-mc-number`}
                placeholder="MC-000000"
                disabled={readOnly}
                aria-invalid={Boolean(errors.mcNumber)}
                {...register("mcNumber")}
              />
              <FieldError
                message={errors.mcNumber?.message}
                premium={premium}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-dispatch-fee`} premium={premium}>
                Dispatch Fee Percentage
              </FieldLabel>
              <Input
                id={`${formId}-dispatch-fee`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                disabled={readOnly}
                aria-invalid={Boolean(errors.dispatchFeePercentage)}
                {...register("dispatchFeePercentage", { valueAsNumber: true })}
              />
              <FieldError
                message={errors.dispatchFeePercentage?.message}
                premium={premium}
              />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-truck-type`} premium={premium}>
              Truck Type
            </FieldLabel>
            <Select
              value={truckType}
              onValueChange={(value) => {
                if (value) {
                  setValue(
                    "truckType",
                    value as CarrierFormValues["truckType"],
                    {
                      shouldValidate: true,
                    },
                  );
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger id={`${formId}-truck-type`} className="w-full">
                <SelectValue placeholder="Select truck type" />
              </SelectTrigger>
              <SelectContent>
                {TRUCK_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.truckType?.message} premium={premium} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-assigned-team`} premium={premium}>
                Assigned Team
              </FieldLabel>
              <Select
                value={assignedTeam}
                onValueChange={(value) => {
                  if (value) {
                    setValue("assignedTeam", value, { shouldValidate: true });
                  }
                }}
                disabled={readOnly}
              >
                <SelectTrigger
                  id={`${formId}-assigned-team`}
                  className="w-full"
                >
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.name}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                message={errors.assignedTeam?.message}
                premium={premium}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel
                htmlFor={`${formId}-assigned-dispatcher`}
                premium={premium}
              >
                Assigned Dispatcher
              </FieldLabel>
              <Select
                value={assignedDispatcher}
                onValueChange={(value) => {
                  if (value) {
                    setValue("assignedDispatcher", value, {
                      shouldValidate: true,
                    });
                  }
                }}
                disabled={readOnly || !assignedTeam || isLoading}
              >
                <SelectTrigger
                  id={`${formId}-assigned-dispatcher`}
                  className="w-full"
                >
                  <SelectValue placeholder={dispatcherPlaceholder} />
                </SelectTrigger>
                <SelectContent {...modalSelectContentProps}>
                  {teamDispatchers.map((dispatcher) => (
                    <SelectItem key={dispatcher.id} value={dispatcher.fullName}>
                      {dispatcher.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                message={errors.assignedDispatcher?.message}
                premium={premium}
              />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-status`} premium={premium}>
              Status
            </FieldLabel>
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) {
                  setValue("status", value as CarrierFormValues["status"], {
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
                {TEAM_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.status?.message} premium={premium} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-notes`} premium={premium}>
              Notes
            </FieldLabel>
            <Textarea
              id={`${formId}-notes`}
              placeholder="Optional notes"
              disabled={readOnly}
              {...register("notes")}
            />
          </div>
        </>
      )}
    </form>
  );
}
