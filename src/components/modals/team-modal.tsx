"use client";

import { TeamDetailView } from "@/components/details/team-detail-view";
import { TeamForm } from "@/components/forms/team-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Team } from "@/lib/types";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import type { TeamFormValues } from "@/lib/validation/team-form";

export type TeamModalMode =
  | "create"
  | "edit"
  | "view"
  | "activate"
  | "deactivate";

type TeamModalProps = {
  open: boolean;
  mode: TeamModalMode;
  team?: Team | null;
  onOpenChange: (open: boolean) => void;
  onCreate?: (values: TeamFormValues) => void;
  onEdit?: (values: TeamFormValues) => void;
  onToggleStatus?: (team: Team) => void;
};

const FORM_ID = "team-form";

function getDefaultValues(team?: Team | null): TeamFormValues | undefined {
  if (!team) {
    return undefined;
  }

  return {
    name: team.name,
    status: team.status,
  };
}

export function TeamModal({
  open,
  mode,
  team,
  onOpenChange,
  onCreate,
  onEdit,
  onToggleStatus,
}: TeamModalProps) {
  const titles: Record<TeamModalMode, string> = {
    create: "Create Team",
    edit: "Edit Team",
    view: "View Team",
    activate: "Activate Team",
    deactivate: "Deactivate Team",
  };

  const descriptions: Record<TeamModalMode, string> = {
    create: "Create a new dispatcher team.",
    edit: "Update team name and status.",
    view: "Team details and assignment preview.",
    activate: "Activate this team and make it available for assignments.",
    deactivate: "Deactivate this team and mark it inactive.",
  };

  function handleSubmit(values: TeamFormValues) {
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

  function handleToggleStatus() {
    if (team) {
      onToggleStatus?.(team);
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

        {mode === "view" && team ? (
          <TeamDetailView team={team} />
        ) : isStatusModal ? (
          <p className="text-muted-foreground text-sm">
            {mode === "activate" ? "Activate" : "Deactivate"}{" "}
            <span className="text-foreground font-medium">{team?.name}</span>?
            This will set the team status to{" "}
            {mode === "activate" ? TEAM_STATUS_ACTIVE : TEAM_STATUS_INACTIVE}.
          </p>
        ) : (
          <TeamForm
            formId={FORM_ID}
            defaultValues={getDefaultValues(mode === "create" ? null : team)}
            readOnly={false}
            onSubmit={handleSubmit}
          />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          {mode === "create" ? (
            <Button type="submit" form={FORM_ID}>
              Create Team
            </Button>
          ) : null}

          {mode === "edit" ? (
            <Button type="submit" form={FORM_ID}>
              Save Changes
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
