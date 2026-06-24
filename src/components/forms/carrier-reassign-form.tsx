"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEntityOptions } from "@/hooks/use-entity-options";
import {
  carrierReassignSchema,
  type CarrierReassignValues,
} from "@/lib/validation/carrier-form";

type CarrierReassignFormProps = {
  formId: string;
  defaultValues?: CarrierReassignValues;
  onSubmit: (values: CarrierReassignValues) => void;
};

export function CarrierReassignForm({
  formId,
  defaultValues,
  onSubmit,
}: CarrierReassignFormProps) {
  const { teams, dispatchers, isLoading } = useEntityOptions();
  const {
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<CarrierReassignValues>({
    resolver: zodResolver(carrierReassignSchema),
    defaultValues: defaultValues ?? {
      assignedTeam: "",
      assignedDispatcher: "",
    },
  });

  const assignedTeam = useWatch({ control, name: "assignedTeam" });
  const assignedDispatcher = useWatch({ control, name: "assignedDispatcher" });

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
    if (defaultValues) {
      reset(defaultValues);
    }
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
      className="space-y-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor={`${formId}-assigned-team`}>Assigned Team</Label>
        <Select
          value={assignedTeam}
          onValueChange={(value) => {
            if (value) {
              setValue("assignedTeam", value, { shouldValidate: true });
            }
          }}
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
          <p className="text-destructive text-sm">
            {errors.assignedTeam.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-assigned-dispatcher`}>
          Assigned Dispatcher
        </Label>
        <Select
          value={assignedDispatcher}
          onValueChange={(value) => {
            if (value) {
              setValue("assignedDispatcher", value, { shouldValidate: true });
            }
          }}
          disabled={!assignedTeam || isLoading}
        >
          <SelectTrigger
            id={`${formId}-assigned-dispatcher`}
            className="w-full"
          >
            <SelectValue placeholder={dispatcherPlaceholder} />
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            side="bottom"
            className="max-h-60"
          >
            {teamDispatchers.map((dispatcher) => (
              <SelectItem key={dispatcher.id} value={dispatcher.fullName}>
                {dispatcher.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.assignedDispatcher ? (
          <p className="text-destructive text-sm">
            {errors.assignedDispatcher.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
