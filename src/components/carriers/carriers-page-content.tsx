"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import { MockToast } from "@/components/feedback/mock-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import {
  CarrierModal,
  type CarrierModalMode,
} from "@/components/modals/carrier-modal";
import {
  CarriersTable,
  type CarrierRowAction,
} from "@/components/tables/carriers-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useMockPageState } from "@/hooks/use-mock-page-state";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import {
  mockCarriers as initialMockCarriers,
} from "@/lib/mock-data";
import type { Carrier } from "@/lib/types";
import type {
  CarrierFormValues,
  CarrierReassignValues,
} from "@/lib/validation/carrier-form";

export function CarriersPageContent() {
  const { filterCarriers } = useRoleScope();
  const [carriers, setCarriers] = useState<Carrier[]>(initialMockCarriers);
  const visibleCarriers = useMemo(
    () => filterCarriers(carriers),
    [carriers, filterCarriers],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CarrierModalMode>("create");
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isEmpty = visibleCarriers.length === 0;
  const { state, retry } = useMockPageState({ isEmpty });

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(
    mode: CarrierModalMode,
    carrier: Carrier | null = null,
  ) {
    setSelectedCarrier(carrier);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(carrier : Carrier, action: CarrierRowAction) {
    if (action === "toggle-status") {
      openModal(
        carrier.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate",
        carrier,
      );
      return;
    }

    openModal(action, carrier);
  }

  function handleCreate(values: CarrierFormValues) {
    const newCarrier : Carrier = {
      id: `car-${crypto.randomUUID()}`,
      carrierName: values.carrierName,
      driverName: values.driverName,
      mcNumber: values.mcNumber,
      truckType: values.truckType,
      assignedTeamName: values.assignedTeam,
      assignedDispatcherName: values.assignedDispatcher,
      dispatchFeePercentage: values.dispatchFeePercentage,
      status: values.status,
      notes: values.notes,
      createdAt: new Date().toISOString(),
    };

    setCarriers((current) => [newCarrier, ...current]);
    showToast(`Carrier "${values.carrierName}" created successfully (mock).`);
  }

  function handleEdit(values: CarrierFormValues) {
    if (!selectedCarrier) {
      return;
    }

    setCarriers((current) =>
      current.map((carrier) =>
        carrier.id === selectedCarrier.id
          ? {
              ...carrier,
              carrierName: values.carrierName,
              driverName: values.driverName,
              mcNumber: values.mcNumber,
              truckType: values.truckType,
              assignedTeamName: values.assignedTeam,
              assignedDispatcherName: values.assignedDispatcher,
              dispatchFeePercentage: values.dispatchFeePercentage,
              status: values.status,
              notes: values.notes,
            }
          : carrier,
      ),
    );

    showToast(`Carrier "${values.carrierName}" updated successfully (mock).`);
  }

  function handleReassign(values: CarrierReassignValues) {
    if (!selectedCarrier) {
      return;
    }

    setCarriers((current) =>
      current.map((carrier) =>
        carrier.id === selectedCarrier.id
          ? {
              ...carrier,
              assignedTeamName: values.assignedTeam,
              assignedDispatcherName: values.assignedDispatcher,
            }
          : carrier,
      ),
    );

    showToast(
      `Carrier "${selectedCarrier.carrierName}" reassigned to ${values.assignedDispatcher} (mock).`,
    );
  }

  function handleToggleStatus(carrier : Carrier) {
    const nextStatus =
      carrier.status === TEAM_STATUS_ACTIVE
        ? TEAM_STATUS_INACTIVE
        : TEAM_STATUS_ACTIVE;

    setCarriers((current) =>
      current.map((item) =>
        item.id === carrier.id ? { ...item, status: nextStatus } : item,
      ),
    );

    showToast(
      `Carrier "${carrier.carrierName}" ${
        nextStatus === TEAM_STATUS_ACTIVE ? "activated" : "deactivated"
      } (mock).`,
    );
  }

  return (
    <>
      <PageShell
        title="Carriers"
        description="Manage carrier profiles, assignments, and dispatch fees. Mock data only — no backend persistence."
      >
        <RoleScopeBanner />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Carrier
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={state}
          onRetry={retry}
          loadingTitle="Loading carriers"
          emptyTitle="No carriers found"
          emptyDescription="Create a carrier profile to manage assignments and dispatch fees."
          emptyActionLabel="Create Carrier"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load carriers"
          errorDescription="Carrier records could not be loaded. Try again in a moment."
        >
          <CarriersTable carriers={visibleCarriers} onAction={handleRowAction} />
        </PageContentGate>
      </PageShell>

      <CarrierModal
        open={modalOpen}
        mode={modalMode}
        carrier={selectedCarrier}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onReassign={handleReassign}
        onToggleStatus={handleToggleStatus}
      />

      <MockToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
