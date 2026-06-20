"use client";

import { CarrierDetailView } from "@/components/details/carrier-detail-view";
import { CarrierForm } from "@/components/forms/carrier-form";
import { CarrierReassignForm } from "@/components/forms/carrier-reassign-form";
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
import type { Carrier } from "@/lib/types";
import type {
  CarrierFormValues,
  CarrierReassignValues,
} from "@/lib/validation/carrier-form";

export type CarrierModalMode =
  | "create"
  | "edit"
  | "view"
  | "reassign"
  | "activate"
  | "deactivate";

type CarrierModalProps = {
  open: boolean;
  mode: CarrierModalMode;
  carrier?: Carrier | null;
  onOpenChange: (open: boolean) => void;
  onCreate?: (values: CarrierFormValues) => void;
  onEdit?: (values: CarrierFormValues) => void;
  onReassign?: (values: CarrierReassignValues) => void;
  onToggleStatus?: (carrier : Carrier) => void;
};

const FORM_ID = "carrier-form";
const REASSIGN_FORM_ID = "carrier-reassign-form";

function getDefaultValues(
  carrier?: Carrier | null,
): CarrierFormValues | undefined {
  if (!carrier) {
    return undefined;
  }

  return {
    carrierName: carrier.carrierName,
    driverName: carrier.driverName,
    mcNumber: carrier.mcNumber,
    dispatchFeePercentage: carrier.dispatchFeePercentage,
    truckType: carrier.truckType,
    assignedTeam: carrier.assignedTeamName,
    assignedDispatcher: carrier.assignedDispatcherName,
    status: carrier.status,
    notes: carrier.notes ?? "",
  };
}

function getReassignDefaults(
  carrier?: Carrier | null,
): CarrierReassignValues | undefined {
  if (!carrier) {
    return undefined;
  }

  return {
    assignedTeam: carrier.assignedTeamName,
    assignedDispatcher: carrier.assignedDispatcherName,
  };
}

export function CarrierModal({
  open,
  mode,
  carrier,
  onOpenChange,
  onCreate,
  onEdit,
  onReassign,
  onToggleStatus,
}: CarrierModalProps) {
  const titles: Record<CarrierModalMode, string> = {
    create: "Create Carrier",
    edit: "Edit Carrier",
    view: "View Carrier",
    reassign: "Reassign Carrier",
    activate: "Activate Carrier",
    deactivate: "Deactivate Carrier",
  };

  const descriptions: Record<CarrierModalMode, string> = {
    create: "Add a new carrier and assign it to a team and dispatcher.",
    edit: "Update carrier profile details.",
    view: "Carrier profile and recent activity.",
    reassign: "Change team and dispatcher assignment.",
    activate: "Mark this carrier as active.",
    deactivate: "Mark this carrier as inactive.",
  };

  function handleSubmit(values: CarrierFormValues) {
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

  function handleReassign(values: CarrierReassignValues) {
    onReassign?.(values);
    onOpenChange(false);
  }

  function handleToggleStatus() {
    if (carrier) {
      onToggleStatus?.(carrier);
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

        {mode === "view" && carrier ? (
          <CarrierDetailView carrier={carrier} />
        ) : isStatusModal ? (
          <p className="text-sm text-muted-foreground">
            {mode === "activate" ? "Activate" : "Deactivate"}{" "}
            <span className="font-medium text-foreground">
              {carrier?.carrierName}
            </span>
            ? This will set the status to{" "}
            {mode === "activate" ? TEAM_STATUS_ACTIVE : TEAM_STATUS_INACTIVE}.
          </p>
        ) : null}

        {mode === "reassign" ? (
          <CarrierReassignForm
            formId={REASSIGN_FORM_ID}
            defaultValues={getReassignDefaults(carrier)}
            onSubmit={handleReassign}
          />
        ) : null}

        {mode === "create" || mode === "edit" ? (
          <CarrierForm
            formId={FORM_ID}
            defaultValues={getDefaultValues(mode === "create" ? null : carrier)}
            readOnly={false}
            onSubmit={handleSubmit}
          />
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          {mode === "create" ? (
            <Button type="submit" form={FORM_ID}>
              Create Carrier
            </Button>
          ) : null}

          {mode === "edit" ? (
            <Button type="submit" form={FORM_ID}>
              Save Changes
            </Button>
          ) : null}

          {mode === "reassign" ? (
            <Button type="submit" form={REASSIGN_FORM_ID}>
              Reassign
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
