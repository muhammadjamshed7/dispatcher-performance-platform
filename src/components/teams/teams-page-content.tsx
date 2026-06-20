"use client";

import { useCallback, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import { MockToast } from "@/components/feedback/mock-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { TeamModal, type TeamModalMode } from "@/components/modals/team-modal";
import { TeamsTable, type TeamRowAction } from "@/components/tables/teams-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useMockPageState } from "@/hooks/use-mock-page-state";
import { mockTeams as initialMockTeams } from "@/lib/mock-data";
import type { Team } from "@/lib/types";
import { TEAM_STATUS_INACTIVE } from "@/lib/constants/team-statuses";
import type { TeamFormValues } from "@/lib/validation/team-form";

export function TeamsPageContent() {
  const [teams, setTeams] = useState<Team[]>(initialMockTeams);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TeamModalMode>("create");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isEmpty = teams.length === 0;
  const { state, retry } = useMockPageState({ isEmpty });

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(mode: TeamModalMode, team: Team | null = null) {
    setSelectedTeam(team);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(team : Team, action: TeamRowAction) {
    openModal(action === "deactivate" ? "deactivate" : action, team);
  }

  function handleCreate(values: TeamFormValues) {
    const newTeam : Team = {
      id: `team-${crypto.randomUUID()}`,
      name: values.name,
      teamLeadName: values.teamLead,
      status: values.status,
      dispatchersCount: 0,
      carriersCount: 0,
      createdAt: new Date().toISOString(),
    };

    setTeams((current) => [newTeam, ...current]);
    showToast(`Team "${values.name}" created successfully (mock).`);
  }

  function handleEdit(values: TeamFormValues) {
    if (!selectedTeam) {
      return;
    }

    setTeams((current) =>
      current.map((team) =>
        team.id === selectedTeam.id
          ? {
              ...team,
              name: values.name,
              teamLeadName: values.teamLead,
              status: values.status,
            }
          : team,
      ),
    );

    showToast(`Team "${values.name}" updated successfully (mock).`);
  }

  function handleDeactivate(team : Team) {
    setTeams((current) =>
      current.map((item) =>
        item.id === team.id ? { ...item, status: TEAM_STATUS_INACTIVE } : item,
      ),
    );

    showToast(`Team "${team.name}" deactivated (mock).`);
  }

  return (
    <>
      <PageShell
        title="Teams"
        description="Manage dispatcher teams, leads, and assignments. Mock data only — no backend persistence."
      >
        <RoleScopeBanner message="Admin-only company team management" />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Create Team
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={state}
          onRetry={retry}
          loadingTitle="Loading teams"
          emptyTitle="No teams found"
          emptyDescription="Create a team to organize dispatchers and carriers."
          emptyActionLabel="Create Team"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load teams"
          errorDescription="Team records could not be loaded. Try again in a moment."
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

      <MockToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
