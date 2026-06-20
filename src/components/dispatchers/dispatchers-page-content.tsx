"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import { MockToast } from "@/components/feedback/mock-toast";
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
import { useMockPageState } from "@/hooks/use-mock-page-state";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import { mockDispatchers as initialMockDispatchers } from "@/lib/mock-data";
import type { Dispatcher } from "@/lib/types";
import type { DispatcherFormValues } from "@/lib/validation/dispatcher-form";

export function DispatchersPageContent() {
  const { filterDispatchers } = useRoleScope();
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>(
    initialMockDispatchers,
  );
  const visibleDispatchers = useMemo(
    () => filterDispatchers(dispatchers),
    [dispatchers, filterDispatchers],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DispatcherModalMode>("create");
  const [selectedDispatcher, setSelectedDispatcher] =
    useState<Dispatcher | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isEmpty = visibleDispatchers.length === 0;
  const { state, retry } = useMockPageState({ isEmpty });

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
    dispatcher : Dispatcher,
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

  function handleCreate(values: DispatcherFormValues) {
    const newDispatcher : Dispatcher = {
      id: `disp-${crypto.randomUUID()}`,
      fullName: values.fullName,
      email: values.email,
      phoneNumber: values.phoneNumber ?? "",
      teamName: values.team,
      role: values.role,
      status: values.status,
      assignedCarriersCount: 0,
      createdAt: new Date().toISOString(),
    };

    setDispatchers((current) => [newDispatcher, ...current]);
    showToast(`Dispatcher "${values.fullName}" created successfully (mock).`);
  }

  function handleEdit(values: DispatcherFormValues) {
    if (!selectedDispatcher) {
      return;
    }

    setDispatchers((current) =>
      current.map((dispatcher) =>
        dispatcher.id === selectedDispatcher.id
          ? {
              ...dispatcher,
              fullName: values.fullName,
              email: values.email,
              phoneNumber: values.phoneNumber ?? "",
              teamName: values.team,
              role: values.role,
              status: values.status,
            }
          : dispatcher,
      ),
    );

    showToast(`Dispatcher "${values.fullName}" updated successfully (mock).`);
  }

  function handleToggleStatus(dispatcher : Dispatcher) {
    const nextStatus =
      dispatcher.status === TEAM_STATUS_ACTIVE
        ? TEAM_STATUS_INACTIVE
        : TEAM_STATUS_ACTIVE;

    setDispatchers((current) =>
      current.map((item) =>
        item.id === dispatcher.id ? { ...item, status: nextStatus } : item,
      ),
    );

    showToast(
      `Dispatcher "${dispatcher.fullName}" ${
        nextStatus === TEAM_STATUS_ACTIVE ? "activated" : "deactivated"
      } (mock).`,
    );
  }

  return (
    <>
      <PageShell
        title="Dispatchers"
        description="Manage dispatcher profiles, team assignments, and carrier ownership. Mock data only — no backend persistence."
      >
        <RoleScopeBanner />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Dispatcher
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={state}
          onRetry={retry}
          loadingTitle="Loading dispatchers"
          emptyTitle="No dispatchers found"
          emptyDescription="Create a dispatcher profile to manage carrier assignments."
          emptyActionLabel="Create Dispatcher"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load dispatchers"
          errorDescription="Dispatcher records could not be loaded. Try again in a moment."
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

      <MockToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
