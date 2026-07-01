"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import {
  entityFiltersToDispatcherParams,
  parseEntityFiltersFromSearchParams,
  type EntityFilterValues,
} from "@/lib/filters/entity-filter-params";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiData } from "@/hooks/use-api-data";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useRoleScope } from "@/hooks/use-role-scope";
import { ApiClientError } from "@/lib/api/client";
import {
  createDispatcherRequest,
  fetchDispatchers,
  toggleDispatcherStatusRequest,
  updateDispatcherRequest,
} from "@/lib/api/resources";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { ADMIN } from "@/lib/constants/roles";
import type { Dispatcher } from "@/lib/types";
import type { DispatcherFormValues } from "@/lib/validation/dispatcher-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

type CreatedDispatcherCredentials = {
  fullName: string;
  email: string;
  temporaryPassword: string;
};

function DispatchersPageContentInner() {
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const urlFilters = useMemo(
    () =>
      parseEntityFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey],
  );

  return (
    <DispatchersPageState key={searchParamKey} initialFilters={urlFilters} />
  );
}

function DispatchersPageState({
  initialFilters,
}: {
  initialFilters: EntityFilterValues;
}) {
  const router = useRouter();
  const { filterDispatchers, user } = useRoleScope();
  const [draftFilters, setDraftFilters] =
    useState<EntityFilterValues>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<EntityFilterValues>(initialFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DispatcherModalMode>("create");
  const [selectedDispatcher, setSelectedDispatcher] =
    useState<Dispatcher | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] =
    useState<CreatedDispatcherCredentials | null>(null);

  const loadDispatchers = useCallback(
    () => fetchDispatchers(entityFiltersToDispatcherParams(appliedFilters)),
    [appliedFilters],
  );
  const {
    data: dispatchers = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadDispatchers, [appliedFilters]);
  // Reuse the teams already loaded by EntityOptionsProvider (also used by the
  // dispatcher form's team picker) instead of issuing a duplicate /api/teams
  // request here. Only used for name → id lookup on create/edit.
  const { teams } = useEntityOptions({
    teams: true,
    dispatchers: false,
    carriers: false,
  });

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
    if (action === "finance") {
      router.push(`/admin/dispatchers/${dispatcher.id}/finance`);
      return;
    }

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
      const result = await createDispatcherRequest({
        fullName: values.fullName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        teamId,
        role: values.role,
        status: values.status,
      });
      setCreatedCredentials({
        fullName: result.dispatcher.fullName,
        email: result.dispatcher.email,
        temporaryPassword: result.temporaryPassword,
      });
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
        {/* <RoleScopeBanner /> */}

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Dispatcher
          </Button>
        </div>

        <EntityFilterBar
          values={draftFilters}
          onChange={setDraftFilters}
          onApply={() => setAppliedFilters(draftFilters)}
          showDateRange={false}
          showCarrier={false}
          showTruckType={false}
          showStatus={false}
        />

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
            error ??
            "Dispatcher records could not be loaded. Try again in a moment."
          }
        >
          <DispatchersTable
            dispatchers={visibleDispatchers}
            onAction={handleRowAction}
            showFinanceAction={user.role === ADMIN}
          />
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

      <Dialog
        open={createdCredentials !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCredentials(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatcher created</DialogTitle>
            <DialogDescription>
              Share these credentials with the dispatcher. They can sign in at
              their portal login page.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="bg-muted/40 space-y-3 rounded-md border p-4 text-sm">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {createdCredentials.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {createdCredentials.email}
              </p>
              <p>
                <span className="font-medium">Temporary password:</span>{" "}
                <code className="bg-background rounded px-2 py-1 font-mono text-xs">
                  {createdCredentials.temporaryPassword}
                </code>
              </p>
              <p className="text-muted-foreground text-xs">
                Ask them to change this password after their first login.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setCreatedCredentials(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

export function DispatchersPageContent() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-sm text-[#64748B]">
          Loading dispatchers...
        </div>
      }
    >
      <DispatchersPageContentInner />
    </Suspense>
  );
}
