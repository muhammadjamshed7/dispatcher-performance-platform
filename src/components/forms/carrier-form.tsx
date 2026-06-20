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
import { useEntityOptions } from "@/hooks/use-entity-options";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import {
  carrierFormSchema,
  defaultCarrierFormValues,
  type CarrierFormValues,
} from "@/lib/validation/carrier-form";

type CarrierFormProps = {
  formId: string;
  defaultValues?: CarrierFormValues;
  readOnly?: boolean;
  onSubmit: (values: CarrierFormValues) => void;
};

export function CarrierForm({
  formId,
  defaultValues = defaultCarrierFormValues,
  readOnly = false,
  onSubmit,
}: CarrierFormProps) {
  const { teams, dispatchers } = useEntityOptions();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CarrierFormValues>({
    resolver: zodResolver(carrierFormSchema),
    defaultValues,
  });

  const truckType = watch("truckType");
  const assignedTeam = watch("assignedTeam");
  const assignedDispatcher = watch("assignedDispatcher");
  const status = watch("status");

  const teamDispatchers = useMemo(
    () =>
      dispatchers.filter(
        (dispatcher) => dispatcher.teamName === assignedTeam,
      ),
    [assignedTeam, dispatchers],
  );

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

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
      className="max-h-[60vh] space-y-4 overflow-y-auto pr-1"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-carrier-name`}>Carrier Name</Label>
          <Input
            id={`${formId}-carrier-name`}
            placeholder="Enter carrier name"
            disabled={readOnly}
            aria-invalid={Boolean(errors.carrierName)}
            {...register("carrierName")}
          />
          {errors.carrierName ? (
            <p className="text-sm text-destructive">{errors.carrierName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-driver-name`}>Driver Name</Label>
          <Input
            id={`${formId}-driver-name`}
            placeholder="Enter driver name"
            disabled={readOnly}
            aria-invalid={Boolean(errors.driverName)}
            {...register("driverName")}
          />
          {errors.driverName ? (
            <p className="text-sm text-destructive">{errors.driverName.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-mc-number`}>MC Number</Label>
          <Input
            id={`${formId}-mc-number`}
            placeholder="MC-000000"
            disabled={readOnly}
            aria-invalid={Boolean(errors.mcNumber)}
            {...register("mcNumber")}
          />
          {errors.mcNumber ? (
            <p className="text-sm text-destructive">{errors.mcNumber.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-dispatch-fee`}>Dispatch Fee Percentage</Label>
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
          {errors.dispatchFeePercentage ? (
            <p className="text-sm text-destructive">
              {errors.dispatchFeePercentage.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-truck-type`}>Truck Type</Label>
        <Select
          value={truckType}
          onValueChange={(value) => {
            if (value) {
              setValue("truckType", value as CarrierFormValues["truckType"], {
                shouldValidate: true,
              });
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
        {errors.truckType ? (
          <p className="text-sm text-destructive">{errors.truckType.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-assigned-team`}>Assigned Team</Label>
          <Select
            value={assignedTeam}
            onValueChange={(value) => {
              if (value) {
                setValue("assignedTeam", value, { shouldValidate: true });
              }
            }}
            disabled={readOnly}
          >
            <SelectTrigger id={`${formId}-assigned-team`} className="w-full">
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
          {errors.assignedTeam ? (
            <p className="text-sm text-destructive">{errors.assignedTeam.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-assigned-dispatcher`}>Assigned Dispatcher</Label>
          <Select
            value={assignedDispatcher}
            onValueChange={(value) => {
              if (value) {
                setValue("assignedDispatcher", value, { shouldValidate: true });
              }
            }}
            disabled={readOnly || !assignedTeam}
          >
            <SelectTrigger id={`${formId}-assigned-dispatcher`} className="w-full">
              <SelectValue placeholder="Select dispatcher" />
            </SelectTrigger>
            <SelectContent>
              {teamDispatchers.map((dispatcher) => (
                <SelectItem key={dispatcher.id} value={dispatcher.fullName}>
                  {dispatcher.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.assignedDispatcher ? (
            <p className="text-sm text-destructive">
              {errors.assignedDispatcher.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-status`}>Status</Label>
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
        {errors.status ? (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        ) : null}
      </div>

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
