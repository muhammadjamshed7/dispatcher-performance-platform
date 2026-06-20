"use client";

import { DispatcherDetailView } from "@/components/details/dispatcher-detail-view";
import { DispatcherForm } from "@/components/forms/dispatcher-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import type { Dispatcher } from "@/lib/types";
import type { DispatcherFormValues } from "@/lib/validation/dispatcher-form";

export type DispatcherModalMode =
  | "create"
  | "edit"
  | "view"
  | "activate"
  | "deactivate";

type DispatcherModalProps = {
  open: boolean;
  mode: DispatcherModalMode;
  dispatcher?: Dispatcher | null;
  onOpenChange: (open: boolean) => void;
  onCreate?: (values: DispatcherFormValues) => void;
  onEdit?: (values: DispatcherFormValues) => void;
  onToggleStatus?: (dispatcher : Dispatcher) => void;
};

const FORM_ID = "dispatcher-form";

function getDefaultValues(
  dispatcher?: Dispatcher | null,
): DispatcherFormValues | undefined {
  if (!dispatcher) {
    return undefined;
  }

  return {
    fullName: dispatcher.fullName,
    email: dispatcher.email,
    phoneNumber: dispatcher.phoneNumber,
    team: dispatcher.teamName,
    role: dispatcher.role,
    status: dispatcher.status,
  };
}

export function DispatcherModal({
  open,
  mode,
  dispatcher,
  onOpenChange,
  onCreate,
  onEdit,
  onToggleStatus,
}: DispatcherModalProps) {
  const titles: Record<DispatcherModalMode, string> = {
    create: "Create Dispatcher",
    edit: "Edit Dispatcher",
    view: "View Dispatcher",
    activate: "Activate Dispatcher",
    deactivate: "Deactivate Dispatcher",
  };

  const descriptions: Record<DispatcherModalMode, string> = {
    create: "Add a new dispatcher using mock frontend validation only.",
    edit: "Update dispatcher details. Changes stay in local mock state.",
    view: "Read-only dispatcher details preview.",
    activate: "Mark this dispatcher as active in mock state only.",
    deactivate: "Mark this dispatcher as inactive in mock state only.",
  };

  function handleSubmit(values: DispatcherFormValues) {
    if (mode === "create") {
      onCreate?.(values);
      onOpenChange(false);
      return;
    }

    if (mode === "edit") {
      onEdit?.(values);
      onOpenChange(false);
    }
  }

  function handleToggleStatus() {
    if (dispatcher) {
      onToggleStatus?.(dispatcher);
      onOpenChange(false);
    }
  }

  const isStatusModal = mode === "activate" || mode === "deactivate";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>{descriptions[mode]}</DialogDescription>
        </DialogHeader>

        {mode === "view" && dispatcher ? (
          <DispatcherDetailView dispatcher={dispatcher} />
        ) : isStatusModal ? (
          <p className="text-sm text-muted-foreground">
            {mode === "activate" ? "Activate" : "Deactivate"}{" "}
            <span className="font-medium text-foreground">
              {dispatcher?.fullName}
            </span>
            ? This will set the status to{" "}
            {mode === "activate" ? TEAM_STATUS_ACTIVE : TEAM_STATUS_INACTIVE}{" "}
            in mock state only.
          </p>
        ) : (
          <DispatcherForm
            formId={FORM_ID}
            defaultValues={getDefaultValues(
              mode === "create" ? null : dispatcher,
            )}
            readOnly={false}
            onSubmit={handleSubmit}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          {mode === "create" ? (
            <Button type="submit" form={FORM_ID}>
              Create Dispatcher
            </Button>
          ) : null}

          {mode === "edit" ? (
            <Button type="submit" form={FORM_ID}>
              Save Changes
            </Button>
          ) : null}

          {isStatusModal ? (
            <Button
              type="button"
              variant={mode === "deactivate" ? "destructive" : "default"}
              onClick={handleToggleStatus}
            >
              {mode === "activate" ? "Activate" : "Deactivate"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
