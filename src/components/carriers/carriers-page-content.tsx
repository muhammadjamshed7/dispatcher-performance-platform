"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { CarriersExcelFilterControls } from "@/components/carriers/carriers-excel-filter-controls";
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
  carrierExcelFiltersToParams,
  parseCarrierExcelFiltersFromSearchParams,
  type CarrierExcelFilterState,
} from "@/lib/filters/carrier-excel-filter-params";
import {
  entityFiltersToCarrierParams,
  parseEntityFiltersFromSearchParams,
  type EntityFilterValues,
} from "@/lib/filters/entity-filter-params";
import {
  createCarrierRequest,
  fetchActivities,
  fetchCarriers,
  reassignCarrierRequest,
  updateCarrierRequest,
} from "@/lib/api/resources";
import { exportCarrierActivityPdf } from "@/lib/reports/export-carrier-activity-pdf";
import { useEntityOptions } from "@/hooks/use-entity-options";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import { ADMIN, DISPATCHER } from "@/lib/constants/roles";
import type { Carrier } from "@/lib/types";
import type {
  CarrierFormValues,
  CarrierReassignValues,
} from "@/lib/validation/carrier-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

type CarriersPageContentProps = {
  showScopeBanner?: boolean;
  compact?: boolean;
};

function CarriersPageContentInner({
  showScopeBanner = true,
  compact = false,
}: CarriersPageContentProps) {
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const urlEntityFilters = useMemo(
    () =>
      parseEntityFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey],
  );
  const urlExcelFilters = useMemo(
    () =>
      parseCarrierExcelFiltersFromSearchParams(
        new URLSearchParams(searchParamKey),
      ),
    [searchParamKey],
  );

  return (
    <CarriersPageState
      key={searchParamKey}
      initialEntityFilters={urlEntityFilters}
      initialExcelFilters={urlExcelFilters}
      showScopeBanner={showScopeBanner && !compact}
      compact={compact}
    />
  );
}

function CarriersPageState({
  initialEntityFilters,
  initialExcelFilters,
  showScopeBanner,
  compact,
}: {
  initialEntityFilters: EntityFilterValues;
  initialExcelFilters: CarrierExcelFilterState;
  showScopeBanner: boolean;
  compact: boolean;
}) {
  const { role } = useRoleScope();
  const canManageCarriers = role !== DISPATCHER;
  const canExportCarrier = role === ADMIN;
  const [draftFilters, setDraftFilters] = useState<EntityFilterValues>(
    initialEntityFilters,
  );
  const [appliedFilters, setAppliedFilters] = useState<EntityFilterValues>(
    initialEntityFilters,
  );
  const [excelAppliedFilters, setExcelAppliedFilters] =
    useState<CarrierExcelFilterState>(initialExcelFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CarrierModalMode>("create");
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadCarriers = useCallback(() => {
    const params = compact
      ? carrierExcelFiltersToParams(excelAppliedFilters)
      : entityFiltersToCarrierParams(appliedFilters);

    return fetchCarriers(params);
  }, [appliedFilters, compact, excelAppliedFilters]);

  const {
    data: carriers = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadCarriers, [
    compact ? excelAppliedFilters : appliedFilters,
    compact,
  ]);
  const {
    teams,
    dispatchers,
    reload: reloadEntityOptions,
  } = useEntityOptions();

  const refreshCarriers = useCallback(async () => {
    await Promise.all([reload(), reloadEntityOptions()]);
  }, [reload, reloadEntityOptions]);

  const carrierRealtimeTables = useMemo(() => ["Carrier"] as const, []);

  useRealtimeRefresh(carrierRealtimeTables, refreshCarriers);

  const visibleCarriers = carriers;

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

  async function handleExportCarrier(carrier: Carrier) {
    try {
      showToast(`Generating report for "${carrier.carrierName}"...`);
      const activities = await fetchActivities({ carrierId: carrier.id });
      await exportCarrierActivityPdf({ carrier, activities });
      showToast(`Report for "${carrier.carrierName}" downloaded.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to export carrier report."));
    }
  }

  function handleRowAction(carrier: Carrier, action: CarrierRowAction) {
    if (action === "toggle-status") {
      openModal(
        carrier.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate",
        carrier,
      );
      return;
    }

    if (action === "export") {
      void handleExportCarrier(carrier);
      return;
    }

    openModal(action, carrier);
  }

  async function handleCreate(values: CarrierFormValues) {
    const { teamId, dispatcherId } = resolveTeamAndDispatcher(values);
    if (!teamId || !dispatcherId) {
      showToast("Selected team or dispatcher not found.");
      throw new Error("Selected team or dispatcher not found.");
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
      throw err;
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
      throw err;
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
      await reassignCarrierRequest(selectedCarrier.id, {
        teamId,
        dispatcherId,
      });
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
        description={
          compact
            ? undefined
            : "Manage carrier profiles, assignments, and dispatch fees."
        }
        actions={
          compact || canManageCarriers ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {compact ? (
                <CarriersExcelFilterControls
                  appliedFilters={excelAppliedFilters}
                  onApplyFilters={setExcelAppliedFilters}
                />
              ) : null}
              {canManageCarriers ? (
                <Button type="button" onClick={() => openModal("create")}>
                  Create Carrier
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {showScopeBanner ? <RoleScopeBanner /> : null}

        {!compact ? (
          <EntityFilterBar
            values={draftFilters}
            onChange={setDraftFilters}
            onApply={() => setAppliedFilters(draftFilters)}
            showCarrier={false}
            statusMode="carrier"
          />
        ) : null}

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading carriers"
          emptyTitle="No carriers found"
          emptyDescription="Create a carrier profile to manage assignments and dispatch fees."
          emptyActionLabel={canManageCarriers ? "Create Carrier" : undefined}
          onEmptyAction={
            canManageCarriers ? () => openModal("create") : undefined
          }
          errorTitle="Unable to load carriers"
          errorDescription={
            error ??
            "Carrier records could not be loaded. Try again in a moment."
          }
        >
          <CarriersTable
            carriers={visibleCarriers}
            readOnly={!canManageCarriers}
            canExport={canExportCarrier}
            onAction={handleRowAction}
          />
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

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

export function CarriersPageContent({
  showScopeBanner = true,
  compact = false,
}: CarriersPageContentProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-sm text-[#64748B]">Loading carriers...</div>
      }
    >
      <CarriersPageContentInner
        showScopeBanner={showScopeBanner}
        compact={compact}
      />
    </Suspense>
  );
}
