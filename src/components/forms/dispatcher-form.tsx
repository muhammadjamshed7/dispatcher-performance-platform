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
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useRoleScope } from "@/hooks/use-role-scope";
import { ADMIN, DISPATCHER } from "@/lib/constants/roles";
import {
  DISPATCHER_ROLES,
  defaultDispatcherFormValues,
  dispatcherFormSchema,
  type DispatcherFormValues,
} from "@/lib/validation/dispatcher-form";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";

type DispatcherFormProps = {
  formId: string;
  defaultValues?: DispatcherFormValues;
  readOnly?: boolean;
  onSubmit: (values: DispatcherFormValues) => void;
};

export function DispatcherForm({
  formId,
  defaultValues = defaultDispatcherFormValues,
  readOnly = false,
  onSubmit,
}: DispatcherFormProps) {
  const { teams } = useEntityOptions();
  const { user } = useRoleScope();
  const assignableRoles =
    user.role === ADMIN ? DISPATCHER_ROLES : ([DISPATCHER] as const);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<DispatcherFormValues>({
    resolver: zodResolver(dispatcherFormSchema),
    defaultValues,
  });

  const team = useWatch({ control, name: "team" });
  const role = useWatch({ control, name: "role" });
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
        <Label htmlFor={`${formId}-full-name`}>Full Name</Label>
        <Input
          id={`${formId}-full-name`}
          placeholder="Enter full name"
          disabled={readOnly}
          aria-invalid={Boolean(errors.fullName)}
          {...register("fullName")}
        />
        {errors.fullName ? (
          <p className="text-destructive text-sm">{errors.fullName.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-email`}>Email</Label>
        <Input
          id={`${formId}-email`}
          type="email"
          placeholder="name@example.com"
          disabled={readOnly}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-destructive text-sm">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-phone`}>Phone Number</Label>
        <Input
          id={`${formId}-phone`}
          type="tel"
          placeholder="+1 (555) 000-0000"
          disabled={readOnly}
          {...register("phoneNumber")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-team`}>Team</Label>
        <Select
          value={team}
          onValueChange={(value) => {
            if (value) {
              setValue("team", value, { shouldValidate: true });
            }
          }}
          disabled={readOnly}
        >
          <SelectTrigger id={`${formId}-team`} className="w-full">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((item) => (
              <SelectItem key={item.id} value={item.name}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.team ? (
          <p className="text-destructive text-sm">{errors.team.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-role`}>Role</Label>
        <Select
          value={role}
          onValueChange={(value) => {
            if (value) {
              setValue("role", value as DispatcherFormValues["role"], {
                shouldValidate: true,
              });
            }
          }}
          disabled={readOnly}
        >
          <SelectTrigger id={`${formId}-role`} className="w-full">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {assignableRoles.map((item) => (
              <SelectItem key={item} value={item}>
                {item.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role ? (
          <p className="text-destructive text-sm">{errors.role.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-status`}>Status</Label>
        <Select
          value={status}
          onValueChange={(value) => {
            if (value) {
              setValue("status", value as DispatcherFormValues["status"], {
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
          <p className="text-destructive text-sm">{errors.status.message}</p>
        ) : null}
      </div>
    </form>
  );
}
