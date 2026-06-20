"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import {
  DispatcherModal,
  type DispatcherModalMode,
} from "@/components/modals/dispatcher-modal";
import {
  DispatchersTable,
  type DispatcherRowAction,
} from "@/components/tables/dispatchers-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useRoleScope } from "@/hooks/use-role-scope";
import { ApiClientError } from "@/lib/api/client";
import {
  createDispatcherRequest,
  fetchDispatchers,
  fetchTeams,
  toggleDispatcherStatusRequest,
  updateDispatcherRequest,
} from "@/lib/api/resources";
import {
  TEAM_STATUS_ACTIVE,
} from "@/lib/constants/team-statuses";
import type { Dispatcher } from "@/lib/types";
import type { DispatcherFormValues } from "@/lib/validation/dispatcher-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export function DispatchersPageContent() {
  const { filterDispatchers } = useRoleScope();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DispatcherModalMode>("create");
  const [selectedDispatcher, setSelectedDispatcher] =
    useState<Dispatcher | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadDispatchers = useCallback(() => fetchDispatchers(), []);
  const loadTeams = useCallback(() => fetchTeams(), []);
  const {
    data: dispatchers = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadDispatchers, []);
  const { data: teams = [] } = useApiData(loadTeams, []);

  const visibleDispatchers = useMemo(
    () => filterDispatchers(dispatchers),
    [dispatchers, filterDispatchers],
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty || visibleDispatchers.length === 0
        ? "empty"
        : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(
    mode: DispatcherModalMode,
    dispatcher: Dispatcher | null = null,
  ) {
    setSelectedDispatcher(dispatcher);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(
    dispatcher: Dispatcher,
    action: DispatcherRowAction,
  ) {
    if (action === "toggle-status") {
      openModal(
        dispatcher.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate",
        dispatcher,
      );
      return;
    }

    openModal(action, dispatcher);
  }

  async function handleCreate(values: DispatcherFormValues) {
    const teamId = teams.find((team) => team.name === values.team)?.id;
    if (!teamId) {
      showToast("Selected team not found.");
      return;
    }

    try {
      await createDispatcherRequest({
        fullName: values.fullName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        teamId,
        role: values.role,
        status: values.status,
      });
      showToast(`Dispatcher "${values.fullName}" created successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create dispatcher."));
    }
  }

  async function handleEdit(values: DispatcherFormValues) {
    if (!selectedDispatcher) {
      return;
    }

    const teamId = teams.find((team) => team.name === values.team)?.id;
    if (!teamId) {
      showToast("Selected team not found.");
      return;
    }

    try {
      await updateDispatcherRequest(selectedDispatcher.id, {
        fullName: values.fullName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        teamId,
        role: values.role,
        status: values.status,
      });
      showToast(`Dispatcher "${values.fullName}" updated successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update dispatcher."));
    }
  }

  async function handleToggleStatus(dispatcher: Dispatcher) {
    const action =
      dispatcher.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate";

    try {
      await toggleDispatcherStatusRequest(dispatcher.id, action);
      showToast(
        `Dispatcher "${dispatcher.fullName}" ${
          action === "activate" ? "activated" : "deactivated"
        }.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update dispatcher status."));
    }
  }

  return (
    <>
      <PageShell
        title="Dispatchers"
        description="Manage dispatcher profiles, team assignments, and carrier ownership."
      >
        <RoleScopeBanner />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Dispatcher
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading dispatchers"
          emptyTitle="No dispatchers found"
          emptyDescription="Create a dispatcher profile to manage carrier assignments."
          emptyActionLabel="Create Dispatcher"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load dispatchers"
          errorDescription={
            error ?? "Dispatcher records could not be loaded. Try again in a moment."
          }
        >
          <DispatchersTable dispatchers={visibleDispatchers} onAction={handleRowAction} />
        </PageContentGate>
      </PageShell>

      <DispatcherModal
        open={modalOpen}
        mode={modalMode}
        dispatcher={selectedDispatcher}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onToggleStatus={handleToggleStatus}
      />

      <AppToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
