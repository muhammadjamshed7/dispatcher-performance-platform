"use client";

import { useCallback, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { TeamModal, type TeamModalMode } from "@/components/modals/team-modal";
import { TeamsTable, type TeamRowAction } from "@/components/tables/teams-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ApiClientError } from "@/lib/api/client";
import {
  createTeamRequest,
  fetchTeams,
  updateTeamRequest,
} from "@/lib/api/resources";
import type { Team } from "@/lib/types";
import { TEAM_STATUS_INACTIVE } from "@/lib/constants/team-statuses";
import type { TeamFormValues } from "@/lib/validation/team-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export function TeamsPageContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TeamModalMode>("create");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadTeams = useCallback(() => fetchTeams(), []);
  const { data: teams = [], error, isLoading, isEmpty, reload } = useApiData(
    loadTeams,
    [],
  );

  useRealtimeRefresh(["Team"], reload);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(mode: TeamModalMode, team: Team | null = null) {
    setSelectedTeam(team);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(team: Team, action: TeamRowAction) {
    openModal(action === "deactivate" ? "deactivate" : action, team);
  }

  async function handleCreate(values: TeamFormValues) {
    try {
      await createTeamRequest({
        name: values.name,
        status: values.status,
      });
      showToast(`Team "${values.name}" created successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create team."));
    }
  }

  async function handleEdit(values: TeamFormValues) {
    if (!selectedTeam) {
      return;
    }

    try {
      await updateTeamRequest(selectedTeam.id, {
        name: values.name,
        status: values.status,
      });
      showToast(`Team "${values.name}" updated successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update team."));
    }
  }

  async function handleDeactivate(team: Team) {
    try {
      await updateTeamRequest(team.id, { status: TEAM_STATUS_INACTIVE });
      showToast(`Team "${team.name}" deactivated.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to deactivate team."));
    }
  }

  return (
    <>
      <PageShell
        title="Teams"
        description="Manage dispatcher teams, leads, and assignments."
      >
        <RoleScopeBanner message="Admin-only company team management" />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Team
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading teams"
          emptyTitle="No teams found"
          emptyDescription="Create a team to organize dispatchers and carriers."
          emptyActionLabel="Create Team"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load teams"
          errorDescription={error ?? "Team records could not be loaded. Try again in a moment."}
        >
          <TeamsTable teams={teams} onAction={handleRowAction} />
        </PageContentGate>
      </PageShell>

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        team={selectedTeam}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
      />

      <AppToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
