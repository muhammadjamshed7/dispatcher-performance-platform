"use client";

import { useState } from "react";

import { ActivityDetailView } from "@/components/details/activity-detail-view";
import { DailyActivityForm } from "@/components/forms/daily-activity-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActivityEditRequestDto, DailyActivity } from "@/lib/types";
import type { DailyActivityFormValues } from "@/lib/validation/daily-activity-form";
import { XIcon } from "lucide-react";

export type ActivityModalMode = "create" | "edit" | "view";

type ActivityModalProps = {
  open: boolean;
  mode: ActivityModalMode;
  activity?: DailyActivity | null;
  pendingEditRequest?: ActivityEditRequestDto | null;
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
  pendingEditRequest,
  allowedStatusReasons = [],
  onOpenChange,
  onCreate,
  onEdit,
}: ActivityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    mode === "create" ? `create-${open}` : `edit-${activity?.id ?? "new"}`;

  const isView = mode === "view";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-slate-950/20 supports-backdrop-filter:backdrop-blur-sm"
        className={
          isView
            ? "flex max-h-[92vh] w-full max-w-5xl flex-col gap-0 overflow-hidden"
            : "flex max-h-[calc(100vh-2rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-4xl"
        }
      >
        <DialogHeader
          className={
            isView
              ? "border-b pr-10 pb-4"
              : "px-6 pt-7 pr-16 pb-5 sm:px-10 sm:pt-10 sm:pb-7"
          }
        >
          <DialogTitle
            className={
              isView
                ? "text-xl font-semibold"
                : "text-foreground text-3xl leading-tight font-semibold tracking-normal sm:text-4xl"
            }
          >
            {titles[mode]}
          </DialogTitle>
          <DialogDescription
            className={
              isView
                ? undefined
                : "text-muted-foreground text-base leading-7 sm:text-lg"
            }
          >
            {descriptions[mode]}
          </DialogDescription>
        </DialogHeader>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="text-foreground hover:bg-muted absolute top-5 right-5 rounded-full sm:top-8 sm:right-8"
            />
          }
        >
          <XIcon className="size-6" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div
          className={
            isView
              ? "-mx-1 flex-1 overflow-y-auto px-1 py-4"
              : "flex-1 overflow-y-auto px-6 pb-7 sm:px-10 sm:pb-9"
          }
        >
          {mode === "view" && activity ? (
            <ActivityDetailView
              activity={activity}
              editRequest={pendingEditRequest}
            />
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
        </div>

        <DialogFooter
          className={
            isView
              ? undefined
              : "bg-background mx-0 mb-0 flex-none rounded-none rounded-b-2xl px-6 py-5 sm:px-10 sm:py-6"
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className={!isView ? "h-11 min-w-32 px-6 text-base" : undefined}
          >
            Cancel
          </Button>

          {mode === "create" ? (
            <Button
              type="submit"
              form={FORM_ID}
              disabled={isSubmitting}
              className={!isView ? "h-11 min-w-40 px-6 text-base" : undefined}
            >
              {isSubmitting ? "Adding..." : "Add Activity"}
            </Button>
          ) : null}

          {mode === "edit" ? (
            <Button
              type="submit"
              form={FORM_ID}
              disabled={isSubmitting}
              className={!isView ? "h-11 min-w-40 px-6 text-base" : undefined}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
