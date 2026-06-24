"use client";

import { useMemo, useState } from "react";
import { Truck } from "lucide-react";

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
import { cn } from "@/lib/utils";

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
  onCreate?: (values: CarrierFormValues) => void | Promise<void>;
  onEdit?: (values: CarrierFormValues) => void | Promise<void>;
  onReassign?: (values: CarrierReassignValues) => void | Promise<void>;
  onToggleStatus?: (carrier: Carrier) => void;
};

const FORM_ID = "carrier-form";
const REASSIGN_FORM_ID = "carrier-reassign-form";

const PREMIUM_DIALOG_CLASS =
  "flex max-h-[calc(100vh-32px)] w-full max-w-[min(820px,calc(100vw-32px))] flex-col gap-0 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-0 text-[#0F172A] shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-0 sm:max-w-[min(820px,calc(100vw-32px))]";

const CARRIER_VIEW_DIALOG_CLASS =
  "flex max-h-[calc(100vh-32px)] w-full max-w-[min(1180px,calc(100vw-32px))] flex-col gap-0 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-0 text-[#0F172A] shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-0 sm:max-w-[min(1180px,calc(100vw-32px))]";

const PREMIUM_OVERLAY_CLASS =
  "bg-[#0F172A]/40 backdrop-blur-[2px] supports-backdrop-filter:backdrop-blur-sm";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    view: "Carrier profile, performance summary, and daily activity history.",
    reassign: "Change team and dispatcher assignment.",
    activate: "Mark this carrier as active.",
    deactivate: "Mark this carrier as inactive.",
  };

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setIsSubmitting(false);
    }

    onOpenChange(nextOpen);
  }

  async function handleSubmit(values: CarrierFormValues) {
    if (mode === "create") {
      setIsSubmitting(true);
      try {
        await onCreate?.(values);
        onOpenChange(false);
      } catch {
        // Parent surfaces errors via toast.
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "edit") {
      setIsSubmitting(true);
      try {
        await onEdit?.(values);
        onOpenChange(false);
      } catch {
        // Parent surfaces errors via toast.
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleReassign(values: CarrierReassignValues) {
    try {
      await onReassign?.(values);
      onOpenChange(false);
    } catch {
      // Parent surfaces errors via toast.
    }
  }

  function handleToggleStatus() {
    if (carrier) {
      onToggleStatus?.(carrier);
      onOpenChange(false);
    }
  }

  const isStatusModal = mode === "activate" || mode === "deactivate";
  const isPremiumCreate = mode === "create";
  const isCarrierView = mode === "view" && carrier;

  const formDefaults = useMemo(
    () => getDefaultValues(mode === "create" ? null : carrier),
    [carrier, mode],
  );

  if (isCarrierView) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          overlayClassName={PREMIUM_OVERLAY_CLASS}
          className={CARRIER_VIEW_DIALOG_CLASS}
        >
          <header className="shrink-0 px-6 pt-8 pb-5 sm:px-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
                  <Truck className="size-6" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-xl font-semibold tracking-tight text-[#0F172A]">
                    {carrier.carrierName}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
                    {descriptions.view}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-10">
            <CarrierDetailView carrier={carrier} />
          </div>

          <footer className="shrink-0 border-t border-[#E5E7EB] px-6 py-6 sm:px-10">
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 text-sm font-medium text-[#334155] transition-colors hover:bg-[#F8FAFC]"
                onClick={() => onOpenChange(false)}
              >
                Close
              </button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
    );
  }

  if (isPremiumCreate) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          overlayClassName={PREMIUM_OVERLAY_CLASS}
          className={PREMIUM_DIALOG_CLASS}
        >
          <header className="shrink-0 px-6 pt-8 pb-5 sm:px-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
                  <Truck className="size-6" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-xl font-semibold tracking-tight text-[#0F172A]">
                    Create Carrier
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
                    Add a new carrier and assign it to a team and dispatcher.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                aria-label="Close"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-10">
            <CarrierForm
              formId={FORM_ID}
              defaultValues={formDefaults}
              readOnly={false}
              variant="premium"
              onSubmit={handleSubmit}
            />
          </div>

          <footer className="shrink-0 border-t border-[#E5E7EB] px-6 py-6 sm:px-10">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 text-sm font-medium text-[#334155] transition-colors hover:bg-[#F8FAFC]",
                  isSubmitting && "cursor-not-allowed opacity-60",
                )}
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={FORM_ID}
                disabled={isSubmitting}
                className={cn(
                  "inline-flex h-11 min-w-[168px] items-center justify-center rounded-xl bg-[#2563EB] px-7 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.25)] transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70",
                )}
              >
                {isSubmitting ? "Creating..." : "Create Carrier"}
              </button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>{descriptions[mode]}</DialogDescription>
        </DialogHeader>

        {isStatusModal ? (
          <p className="text-muted-foreground text-sm">
            {mode === "activate" ? "Activate" : "Deactivate"}{" "}
            <span className="text-foreground font-medium">
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

        {mode === "edit" ? (
          <CarrierForm
            formId={FORM_ID}
            defaultValues={formDefaults}
            readOnly={false}
            onSubmit={handleSubmit}
          />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          {mode === "edit" ? (
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
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
