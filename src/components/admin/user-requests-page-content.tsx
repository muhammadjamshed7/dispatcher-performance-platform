"use client";

import { useCallback, useMemo, useState } from "react";
import { Eye, MoreHorizontal } from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/status-badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ApiClientError } from "@/lib/api/client";
import {
  approveUserRequest,
  fetchTeams,
  fetchUserRequests,
  rejectUserRequest,
} from "@/lib/api/resources";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format-date";
import type { PendingUserRequest } from "@/lib/types";

type ModalAction = "view" | "approve" | "reject" | null;

type ApprovedCredentials = {
  fullName: string;
  email: string;
  temporaryPassword: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function generateTemporaryPassword() {
  return `${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}Aa1!`;
}

function resolveDefaultTeamId(
  request: PendingUserRequest,
  teams: { id: string; name: string }[],
): string {
  if (request.preferredTeam) {
    const preferred = teams.find((team) => team.name === request.preferredTeam);
    if (preferred) {
      return preferred.id;
    }
  }

  const defaultTeam = teams.find((team) => team.name === "Default Team");
  if (defaultTeam) {
    return defaultTeam.id;
  }

  return teams[0]?.id ?? "";
}

export function UserRequestsPageContent() {
  const [selectedRequest, setSelectedRequest] =
    useState<PendingUserRequest | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [assignedTeamId, setAssignedTeamId] = useState<string>("");
  const [approvedRole, setApprovedRole] = useState<
    typeof DISPATCHER | typeof TEAM_LEAD
  >(DISPATCHER);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedCredentials, setApprovedCredentials] =
    useState<ApprovedCredentials | null>(null);

  const loadRequests = useCallback(() => fetchUserRequests(), []);
  const loadTeams = useCallback(() => fetchTeams(), []);

  const {
    data: requests = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadRequests, []);
  const { data: teams = [] } = useApiData(loadTeams, []);

  useRealtimeRefresh(["RegistrationRequest"], reload);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const pendingCount = useMemo(
    () =>
      requests.filter((request) => request.status === "PENDING_APPROVAL")
        .length,
    [requests],
  );

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const openModal = (request: PendingUserRequest, action: ModalAction) => {
    setSelectedRequest(request);
    setModalAction(action);
    setAssignedTeamId(resolveDefaultTeamId(request, teams));
    setApprovedRole(DISPATCHER);
    setModalError(null);
    setApprovedCredentials(null);
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setModalAction(null);
    setAssignedTeamId("");
    setModalError(null);
    setIsSubmitting(false);
    setApprovedCredentials(null);
  };

  async function handleConfirmAction() {
    if (!selectedRequest || approvedCredentials) {
      closeModal();
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (modalAction === "approve") {
        const teamId =
          assignedTeamId ||
          (selectedRequest ? resolveDefaultTeamId(selectedRequest, teams) : "");

        if (!teamId) {
          setModalError(
            "No teams are available. Create a team before approving users.",
          );
          return;
        }

        const temporaryPassword = generateTemporaryPassword();

        await approveUserRequest(selectedRequest.id, {
          role: approvedRole,
          teamId,
          temporaryPassword,
        });

        setApprovedCredentials({
          fullName: selectedRequest.fullName,
          email: selectedRequest.email,
          temporaryPassword,
        });
        showToast(
          `Approved "${selectedRequest.fullName}". Share the temporary password securely.`,
        );
        await reload();
        return;
      }

      if (modalAction === "reject") {
        await rejectUserRequest(selectedRequest.id, {
          reason: "Registration request rejected by administrator.",
        });
        showToast(`Request for "${selectedRequest.fullName}" rejected.`);
      }

      closeModal();
      await reload();
    } catch (err) {
      setModalError(getErrorMessage(err, "Failed to process request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const modalDescription = (() => {
    if (approvedCredentials) {
      return "Copy the temporary password and share it with the dispatcher through a secure channel.";
    }

    switch (modalAction) {
      case "approve":
        return "Assign a team and confirm to create the dispatcher account.";
      case "reject":
        return "This will reject the registration request.";
      case "view":
        return "Review the submitted registration details.";
      default:
        return "";
    }
  })();

  const modalTitle = (() => {
    if (approvedCredentials) {
      return "Account Approved";
    }

    switch (modalAction) {
      case "view":
        return "Registration Request Details";
      case "approve":
        return "Approve User Request";
      case "reject":
        return "Reject User Request";
      default:
        return "";
    }
  })();

  return (
    <>
      <PageShell
        title="User Requests"
        description="Review pending dispatcher registration requests and approve or reject access."
      >
        <RoleScopeBanner message="Admin approval queue" />

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading user requests"
          emptyTitle="No user requests"
          emptyDescription="There are no pending registration requests."
          errorTitle="Unable to load user requests"
          errorDescription={
            error ?? "User requests could not be loaded. Try again in a moment."
          }
        >
          <div className="bg-card rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-muted-foreground text-sm">
                {pendingCount} pending request{pendingCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Requested Role</TableHead>
                    <TableHead>Preferred Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.fullName}
                      </TableCell>
                      <TableCell>{request.email}</TableCell>
                      <TableCell>{request.phoneNumber}</TableCell>
                      <TableCell>
                        {request.requestedRole.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>{request.preferredTeam ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>{formatDate(request.submittedAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                type="button"
                              />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openModal(request, "view")}
                            >
                              <Eye className="mr-2 size-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openModal(request, "approve")}
                            >
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openModal(request, "reject")}
                            >
                              Reject
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </PageContentGate>
      </PageShell>

      <Dialog
        open={modalAction !== null}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            {modalDescription ? (
              <DialogDescription>{modalDescription}</DialogDescription>
            ) : null}
          </DialogHeader>

          {modalError ? (
            <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {modalError}
            </p>
          ) : null}

          {approvedCredentials ? (
            <div className="bg-muted/40 space-y-3 rounded-md border p-4 text-sm">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {approvedCredentials.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {approvedCredentials.email}
              </p>
              <p>
                <span className="font-medium">Temporary password:</span>{" "}
                <code className="bg-background rounded px-2 py-1 font-mono text-xs">
                  {approvedCredentials.temporaryPassword}
                </code>
              </p>
              <p className="text-muted-foreground text-xs">
                The dispatcher can sign in at /dispatcher/login. Ask them to
                change this password after their first login.
              </p>
            </div>
          ) : null}

          {selectedRequest && !approvedCredentials ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {selectedRequest.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {selectedRequest.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span>{" "}
                {selectedRequest.phoneNumber}
              </p>
              <p>
                <span className="font-medium">Requested role:</span>{" "}
                {selectedRequest.requestedRole.replaceAll("_", " ")}
              </p>
              {selectedRequest.notes ? (
                <p>
                  <span className="font-medium">Notes:</span>{" "}
                  {selectedRequest.notes}
                </p>
              ) : null}

              {modalAction === "approve" ? (
                <div className="space-y-2">
                  <p className="font-medium">Approved role</p>
                  <Select
                    value={approvedRole}
                    onValueChange={(value) => {
                      if (value === DISPATCHER || value === TEAM_LEAD) {
                        setApprovedRole(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DISPATCHER}>Dispatcher</SelectItem>
                      <SelectItem value={TEAM_LEAD}>Team Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {modalAction === "approve" ? (
                <div className="space-y-2">
                  <p className="font-medium">Select team</p>
                  <Select
                    value={assignedTeamId || null}
                    onValueChange={(value) => {
                      if (value) {
                        setAssignedTeamId(value);
                        setModalError(null);
                      }
                    }}
                    disabled={teams.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {teams.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Loading teams…
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={closeModal}>
              {approvedCredentials ? "Close" : "Cancel"}
            </Button>
            {!approvedCredentials && modalAction !== "view" ? (
              <Button
                type="button"
                onClick={handleConfirmAction}
                disabled={
                  isSubmitting ||
                  (modalAction === "approve" && teams.length === 0)
                }
              >
                {isSubmitting ? "Processing…" : "Confirm"}
              </Button>
            ) : null}
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
