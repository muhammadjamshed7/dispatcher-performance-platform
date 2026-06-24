"use client";

import { useEffect, useState } from "react";

import { ActivityDetailView } from "@/components/details/activity-detail-view";
import { DailyActivityForm } from "@/components/forms/daily-activity-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DailyActivity } from "@/lib/types";
import type { DailyActivityFormValues } from "@/lib/validation/daily-activity-form";

export type ActivityModalMode = "create" | "edit" | "view";

type ActivityModalProps = {
  open: boolean;
  mode: ActivityModalMode;
  activity?: DailyActivity | null;
  allowedStatusReasons?: string[];
  onOpenChange: (open: boolean) => void;
  onCreate?: (values: DailyActivityFormValues) => void | Promise<void>;
  onEdit?: (values: DailyActivityFormValues) => void | Promise<void>;
};

const FORM_ID = "daily-activity-form";

function getDefaultValues(
  activity?: DailyActivity | null,
): DailyActivityFormValues | undefined {
  if (!activity) {
    return undefined;
  }

  return {
    date: activity.date,
    carrierId: activity.carrierId,
    status: activity.status,
    notes: activity.notes ?? "",
    origin: activity.origin ?? "",
    destination: activity.destination ?? "",
    totalMiles: activity.miles ?? undefined,
    loadAmount: activity.loadAmount ?? undefined,
    reason: activity.reason ?? "",
  };
}

export function ActivityModal({
  open,
  mode,
  activity,
  allowedStatusReasons = [],
  onOpenChange,
  onCreate,
  onEdit,
}: ActivityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);

  useEffect(() => {
    if (open && mode === "create") {
      setCreateFormKey((current) => current + 1);
    }
  }, [mode, open]);

  const titles: Record<ActivityModalMode, string> = {
    create: "Add Activity",
    edit: "Edit Activity",
    view: "View Activity",
  };

  const descriptions: Record<ActivityModalMode, string> = {
    create: "Log daily carrier activity for your assigned carriers.",
    edit: "Update activity details for this carrier and date.",
    view: "Activity details and financial summary.",
  };

  async function handleSubmit(values: DailyActivityFormValues) {
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await onCreate?.(values);
        onOpenChange(false);
        return;
      }

      if (mode === "edit") {
        await onEdit?.(values);
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const formKey =
    mode === "create" ? `create-${createFormKey}` : `edit-${activity?.id ?? "new"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>{descriptions[mode]}</DialogDescription>
        </DialogHeader>

        {mode === "view" && activity ? (
          <ActivityDetailView activity={activity} />
        ) : (
          <DailyActivityForm
            key={formKey}
            formId={FORM_ID}
            defaultValues={getDefaultValues(
              mode === "create" ? null : activity,
            )}
            carrierLabelFallback={activity?.carrierName}
            allowedStatusReasons={allowedStatusReasons}
            onSubmit={handleSubmit}
          />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          {mode === "create" ? (
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Activity"}
            </Button>
          ) : null}

          {mode === "edit" ? (
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
