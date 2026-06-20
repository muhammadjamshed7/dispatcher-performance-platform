"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
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
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useRoleScope } from "@/hooks/use-role-scope";
import { ApiClientError } from "@/lib/api/client";
import {
  createCarrierRequest,
  fetchCarriers,
  fetchDispatchers,
  fetchTeams,
  reassignCarrierRequest,
  updateCarrierRequest,
} from "@/lib/api/resources";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import type { Carrier } from "@/lib/types";
import type {
  CarrierFormValues,
  CarrierReassignValues,
} from "@/lib/validation/carrier-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export function CarriersPageContent() {
  const { filterCarriers } = useRoleScope();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CarrierModalMode>("create");
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadCarriers = useCallback(() => fetchCarriers(), []);
  const loadTeams = useCallback(() => fetchTeams(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);

  const {
    data: carriers = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadCarriers, []);
  const { data: teams = [] } = useApiData(loadTeams, []);
  const { data: dispatchers = [] } = useApiData(loadDispatchers, []);

  useRealtimeRefresh(["Carrier"], reload);

  const visibleCarriers = useMemo(
    () => filterCarriers(carriers),
    [carriers, filterCarriers],
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty || visibleCarriers.length === 0
        ? "empty"
        : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function resolveTeamAndDispatcher(values: {
    assignedTeam: string;
    assignedDispatcher: string;
  }) {
    const teamId = teams.find((team) => team.name === values.assignedTeam)?.id;
    const dispatcherId = dispatchers.find(
      (dispatcher) => dispatcher.fullName === values.assignedDispatcher,
    )?.id;

    return { teamId, dispatcherId };
  }

  function openModal(mode: CarrierModalMode, carrier: Carrier | null = null) {
    setSelectedCarrier(carrier);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(carrier: Carrier, action: CarrierRowAction) {
    if (action === "toggle-status") {
      openModal(
        carrier.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate",
        carrier,
      );
      return;
    }

    openModal(action, carrier);
  }

  async function handleCreate(values: CarrierFormValues) {
    const { teamId, dispatcherId } = resolveTeamAndDispatcher(values);
    if (!teamId || !dispatcherId) {
      showToast("Selected team or dispatcher not found.");
      return;
    }

    try {
      await createCarrierRequest({
        carrierName: values.carrierName,
        driverName: values.driverName,
        mcNumber: values.mcNumber,
        dispatchFeePercentage: values.dispatchFeePercentage,
        truckType: values.truckType,
        teamId,
        dispatcherId,
        status: values.status,
        notes: values.notes,
      });
      showToast(`Carrier "${values.carrierName}" created successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create carrier."));
    }
  }

  async function handleEdit(values: CarrierFormValues) {
    if (!selectedCarrier) {
      return;
    }

    try {
      await updateCarrierRequest(selectedCarrier.id, {
        carrierName: values.carrierName,
        driverName: values.driverName,
        mcNumber: values.mcNumber,
        dispatchFeePercentage: values.dispatchFeePercentage,
        truckType: values.truckType,
        status: values.status,
        notes: values.notes,
      });
      showToast(`Carrier "${values.carrierName}" updated successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update carrier."));
    }
  }

  async function handleReassign(values: CarrierReassignValues) {
    if (!selectedCarrier) {
      return;
    }

    const { teamId, dispatcherId } = resolveTeamAndDispatcher(values);
    if (!teamId || !dispatcherId) {
      showToast("Selected team or dispatcher not found.");
      return;
    }

    try {
      await reassignCarrierRequest(selectedCarrier.id, { teamId, dispatcherId });
      showToast(
        `Carrier "${selectedCarrier.carrierName}" reassigned to ${values.assignedDispatcher}.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to reassign carrier."));
    }
  }

  async function handleToggleStatus(carrier: Carrier) {
    const nextStatus =
      carrier.status === TEAM_STATUS_ACTIVE
        ? TEAM_STATUS_INACTIVE
        : TEAM_STATUS_ACTIVE;

    try {
      await updateCarrierRequest(carrier.id, { status: nextStatus });
      showToast(
        `Carrier "${carrier.carrierName}" ${
          nextStatus === TEAM_STATUS_ACTIVE ? "activated" : "deactivated"
        }.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update carrier status."));
    }
  }

  return (
    <>
      <PageShell
        title="Carriers"
        description="Manage carrier profiles, assignments, and dispatch fees."
      >
        <RoleScopeBanner />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Carrier
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading carriers"
          emptyTitle="No carriers found"
          emptyDescription="Create a carrier profile to manage assignments and dispatch fees."
          emptyActionLabel="Create Carrier"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load carriers"
          errorDescription={
            error ?? "Carrier records could not be loaded. Try again in a moment."
          }
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

      <AppToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
