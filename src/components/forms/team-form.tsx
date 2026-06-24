"use client";

import { useEffect } from "react";
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
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import {
  defaultTeamFormValues,
  teamFormSchema,
  type TeamFormValues,
} from "@/lib/validation/team-form";

type TeamFormProps = {
  formId: string;
  defaultValues?: TeamFormValues;
  readOnly?: boolean;
  onSubmit: (values: TeamFormValues) => void;
};

export function TeamForm({
  formId,
  defaultValues = defaultTeamFormValues,
  readOnly = false,
  onSubmit,
}: TeamFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues,
  });

  const status = useWatch({ control, name: "status" });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>Team Name</Label>
        <Input
          id={`${formId}-name`}
          placeholder="Enter team name"
          disabled={readOnly}
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-status`}>Status</Label>
        <Select
          value={status}
          onValueChange={(value) =>
            setValue("status", value as TeamFormValues["status"], {
              shouldValidate: true,
            })
          }
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
          <p className="text-destructive text-sm">{errors.status.message}</p>
        ) : null}
      </div>
    </form>
  );
}
