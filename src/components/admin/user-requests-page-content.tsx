"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy, Eye, KeyRound, MoreHorizontal, UserPlus } from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ApiClientError } from "@/lib/api/client";
import {
  approveUserRequest,
  createManagedUserRequest,
  fetchManagedUsers,
  fetchUserRequests,
  rejectUserRequest,
  resetManagedUserPasswordRequest,
} from "@/lib/api/resources";
import { ACTIVE } from "@/lib/auth/user-statuses";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format-date";
import type {
  ManagedUser,
  ManagedUserCredentials,
  PendingUserRequest,
} from "@/lib/types";

type ModalAction = "view" | "approve" | "reject" | null;
type UserModalAction = "create" | "view-user" | "reset-password" | null;

type ApprovedCredentials = {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: typeof DISPATCHER | typeof TEAM_LEAD;
  loginPath: string;
};

type CreateUserFormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  role: typeof DISPATCHER | typeof TEAM_LEAD;
  teamId: string;
  password: string;
  confirmPassword: string;
};

type PasswordFormState = {
  password: string;
  confirmPassword: string;
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

type CredentialConfirmation = ManagedUserCredentials & {
  title: string;
  description: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function generateTemporaryPassword() {
  return `${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}Aa1!`;
}

function createDefaultUserForm(teamId = ""): CreateUserFormState {
  return {
    fullName: "",
    email: "",
    phoneNumber: "",
    role: DISPATCHER,
    teamId,
    password: "",
    confirmPassword: "",
  };
}

function createDefaultPasswordForm(): PasswordFormState {
  return {
    password: "",
    confirmPassword: "",
  };
}

function validateCreateUserForm(values: CreateUserFormState) {
  const errors: FormErrors<CreateUserFormState> = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email.";
  }

  if (!values.teamId) {
    errors.teamId = "Team is required.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm password is required.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function validatePasswordForm(values: PasswordFormState) {
  const errors: FormErrors<PasswordFormState> = {};

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm password is required.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function getRoleLabel(role: typeof DISPATCHER | typeof TEAM_LEAD) {
  return role === TEAM_LEAD ? "Team Lead" : "Dispatcher";
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
  const [userModalAction, setUserModalAction] = useState<UserModalAction>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>(
    () => createDefaultUserForm(),
  );
  const [createUserErrors, setCreateUserErrors] = useState<
    FormErrors<CreateUserFormState>
  >({});
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(() =>
    createDefaultPasswordForm(),
  );
  const [passwordErrors, setPasswordErrors] = useState<
    FormErrors<PasswordFormState>
  >({});
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);
  const [credentialConfirmation, setCredentialConfirmation] =
    useState<CredentialConfirmation | null>(null);

  const loadRequests = useCallback(() => fetchUserRequests(), []);
  const loadManagedUsers = useCallback(() => fetchManagedUsers(), []);

  const {
    data: requests = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadRequests, []);
  // Reuse the teams already loaded by EntityOptionsProvider (admin scope = all
  // teams) for the approve/create-user team pickers instead of a duplicate
  // /api/teams request.
  const { teams } = useEntityOptions();
  const {
    data: managedUsers = [],
    error: managedUsersError,
    isLoading: managedUsersLoading,
    reload: reloadManagedUsers,
  } = useApiData(loadManagedUsers, []);

  const requestRealtimeTables = useMemo(
    () => ["RegistrationRequest", "User"] as const,
    [],
  );

  const refreshUsersAndRequests = useCallback(() => {
    void reload();
    void reloadManagedUsers();
  }, [reload, reloadManagedUsers]);

  useRealtimeRefresh(requestRealtimeTables, refreshUsersAndRequests);

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

  const closeUserModal = () => {
    setUserModalAction(null);
    setSelectedUser(null);
    setCreateUserForm(createDefaultUserForm());
    setCreateUserErrors({});
    setPasswordForm(createDefaultPasswordForm());
    setPasswordErrors({});
    setUserModalError(null);
    setIsUserSubmitting(false);
  };

  const openCreateUserModal = () => {
    setUserModalAction("create");
    setSelectedUser(null);
    setCreateUserForm(createDefaultUserForm(teams[0]?.id ?? ""));
    setCreateUserErrors({});
    setUserModalError(null);
  };

  const openUserModal = (user: ManagedUser, action: UserModalAction) => {
    setSelectedUser(user);
    setUserModalAction(action);
    setPasswordForm(createDefaultPasswordForm());
    setPasswordErrors({});
    setUserModalError(null);
  };

  const updateCreateUserForm = <K extends keyof CreateUserFormState>(
    key: K,
    value: CreateUserFormState[K],
  ) => {
    setCreateUserForm((current) => ({ ...current, [key]: value }));
    setCreateUserErrors((current) => ({ ...current, [key]: undefined }));
    setUserModalError(null);
  };

  const updatePasswordForm = <K extends keyof PasswordFormState>(
    key: K,
    value: PasswordFormState[K],
  ) => {
    setPasswordForm((current) => ({ ...current, [key]: value }));
    setPasswordErrors((current) => ({ ...current, [key]: undefined }));
    setUserModalError(null);
  };

  const fillGeneratedCreatePassword = () => {
    const password = generateTemporaryPassword();
    setCreateUserForm((current) => ({
      ...current,
      password,
      confirmPassword: password,
    }));
    setCreateUserErrors((current) => ({
      ...current,
      password: undefined,
      confirmPassword: undefined,
    }));
  };

  const fillGeneratedResetPassword = () => {
    const password = generateTemporaryPassword();
    setPasswordForm({ password, confirmPassword: password });
    setPasswordErrors({});
  };

  async function copyCredentialText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied.`);
    } catch {
      showToast(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

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
          role: approvedRole,
          loginPath:
            approvedRole === TEAM_LEAD
              ? "/team-lead/login"
              : "/dispatcher/login",
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

  async function handleCreateUser() {
    const nextErrors = validateCreateUserForm(createUserForm);
    setCreateUserErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsUserSubmitting(true);
    setUserModalError(null);

    try {
      const result = await createManagedUserRequest({
        ...createUserForm,
        email: createUserForm.email.trim().toLowerCase(),
        fullName: createUserForm.fullName.trim(),
        phoneNumber: createUserForm.phoneNumber.trim() || undefined,
        status: ACTIVE,
      });

      setCredentialConfirmation({
        ...result.credentials,
        title: "User Created",
        description: `${getRoleLabel(result.credentials.role)} can sign in immediately using these credentials.`,
      });
      showToast(`Created "${result.user.fullName}".`);
      closeUserModal();
      await reloadManagedUsers();
      await reload();
    } catch (err) {
      setUserModalError(getErrorMessage(err, "Failed to create user."));
    } finally {
      setIsUserSubmitting(false);
    }
  }

  async function handleResetUserPassword() {
    if (!selectedUser) {
      return;
    }

    const nextErrors = validatePasswordForm(passwordForm);
    setPasswordErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsUserSubmitting(true);
    setUserModalError(null);

    try {
      const result = await resetManagedUserPasswordRequest(selectedUser.id, {
        ...passwordForm,
      });

      setCredentialConfirmation({
        ...result.credentials,
        title: "Password Reset",
        description: `Share the updated credentials with ${result.user.fullName} through a secure channel.`,
      });
      showToast(`Password reset for "${result.user.fullName}".`);
      closeUserModal();
      await reloadManagedUsers();
    } catch (err) {
      setUserModalError(getErrorMessage(err, "Failed to reset password."));
    } finally {
      setIsUserSubmitting(false);
    }
  }

  const modalDescription = (() => {
    if (approvedCredentials) {
      return "Copy the temporary password and share it with the user through a secure channel.";
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

  const userModalTitle = (() => {
    switch (userModalAction) {
      case "create":
        return "Create User";
      case "view-user":
        return "User Details";
      case "reset-password":
        return "Reset Password";
      default:
        return "";
    }
  })();

  const userModalDescription = (() => {
    switch (userModalAction) {
      case "create":
        return "Create a dispatcher or team lead account without waiting for self-registration.";
      case "view-user":
        return "Review the user account, role, team assignment, and portal access.";
      case "reset-password":
        return selectedUser
          ? `Set a new password for ${selectedUser.fullName}.`
          : "Set a new password for this user.";
      default:
        return "";
    }
  })();

  return (
    <>
      <PageShell
        title="User Requests"
        description="Review pending registrations and create dispatcher or team lead users manually."
        actions={
          <Button type="button" onClick={openCreateUserModal}>
            <UserPlus className="size-4" />
            Create User
          </Button>
        }
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

        <div className="bg-card rounded-lg border">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">User Accounts</p>
              <p className="text-muted-foreground text-sm">
                Dispatcher and team lead users created or approved in this
                organization.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={openCreateUserModal}
            >
              <UserPlus className="size-4" />
              Create User
            </Button>
          </div>

          {managedUsersError ? (
            <div className="p-4">
              <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {managedUsersError}
              </p>
            </div>
          ) : managedUsersLoading ? (
            <p className="text-muted-foreground p-4 text-sm">
              Loading user accounts...
            </p>
          ) : managedUsers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-medium">No user accounts yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create a dispatcher or team lead to see them here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phoneNumber ?? "-"}</TableCell>
                      <TableCell>{getRoleLabel(user.role)}</TableCell>
                      <TableCell>{user.teamName ?? "Unassigned"}</TableCell>
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted rounded px-2 py-1 text-xs">
                          {user.loginPath}
                        </code>
                      </TableCell>
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
                              onClick={() => openUserModal(user, "view-user")}
                            >
                              <Eye className="mr-2 size-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                openUserModal(user, "reset-password")
                              }
                              disabled={!user.hasAuthUser}
                            >
                              <KeyRound className="mr-2 size-4" />
                              Reset Password
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
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
                <span className="font-medium">Role:</span>{" "}
                {getRoleLabel(approvedCredentials.role)}
              </p>
              <p>
                <span className="font-medium">Temporary password:</span>{" "}
                <code className="bg-background rounded px-2 py-1 font-mono text-xs">
                  {approvedCredentials.temporaryPassword}
                </code>
              </p>
              <p>
                <span className="font-medium">Login portal:</span>{" "}
                <code className="bg-background rounded px-2 py-1 text-xs">
                  {approvedCredentials.loginPath}
                </code>
              </p>
              <p className="text-muted-foreground text-xs">
                Ask them to change this password after their first login.
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

      <Dialog
        open={userModalAction !== null}
        onOpenChange={(open) => !open && closeUserModal()}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{userModalTitle}</DialogTitle>
            {userModalDescription ? (
              <DialogDescription>{userModalDescription}</DialogDescription>
            ) : null}
          </DialogHeader>

          {userModalError ? (
            <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {userModalError}
            </p>
          ) : null}

          {userModalAction === "create" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-user-full-name">Full Name</Label>
                  <Input
                    id="create-user-full-name"
                    value={createUserForm.fullName}
                    onChange={(event) =>
                      updateCreateUserForm("fullName", event.target.value)
                    }
                    placeholder="Enter full name"
                    aria-invalid={Boolean(createUserErrors.fullName)}
                  />
                  {createUserErrors.fullName ? (
                    <p className="text-destructive text-sm">
                      {createUserErrors.fullName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-user-email">Email</Label>
                  <Input
                    id="create-user-email"
                    type="email"
                    value={createUserForm.email}
                    onChange={(event) =>
                      updateCreateUserForm("email", event.target.value)
                    }
                    placeholder="name@example.com"
                    aria-invalid={Boolean(createUserErrors.email)}
                  />
                  {createUserErrors.email ? (
                    <p className="text-destructive text-sm">
                      {createUserErrors.email}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-user-phone">Phone Number</Label>
                  <Input
                    id="create-user-phone"
                    type="tel"
                    value={createUserForm.phoneNumber}
                    onChange={(event) =>
                      updateCreateUserForm("phoneNumber", event.target.value)
                    }
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex h-8 items-center">
                    <Badge>{ACTIVE}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-user-role">Role</Label>
                  <Select
                    value={createUserForm.role}
                    onValueChange={(value) => {
                      if (value === DISPATCHER || value === TEAM_LEAD) {
                        updateCreateUserForm("role", value);
                      }
                    }}
                  >
                    <SelectTrigger id="create-user-role" className="w-full">
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DISPATCHER}>Dispatcher</SelectItem>
                      <SelectItem value={TEAM_LEAD}>Team Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-user-team">Team</Label>
                  <Select
                    value={createUserForm.teamId || null}
                    onValueChange={(value) => {
                      if (value) {
                        updateCreateUserForm("teamId", value);
                      }
                    }}
                    disabled={teams.length === 0}
                  >
                    <SelectTrigger
                      id="create-user-team"
                      className="w-full"
                      aria-invalid={Boolean(createUserErrors.teamId)}
                    >
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
                  {createUserErrors.teamId ? (
                    <p className="text-destructive text-sm">
                      {createUserErrors.teamId}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="create-user-password">Password</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={fillGeneratedCreatePassword}
                    >
                      Generate
                    </Button>
                  </div>
                  <Input
                    id="create-user-password"
                    type="password"
                    value={createUserForm.password}
                    onChange={(event) =>
                      updateCreateUserForm("password", event.target.value)
                    }
                    aria-invalid={Boolean(createUserErrors.password)}
                  />
                  {createUserErrors.password ? (
                    <p className="text-destructive text-sm">
                      {createUserErrors.password}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-user-confirm-password">
                    Confirm Password
                  </Label>
                  <Input
                    id="create-user-confirm-password"
                    type="password"
                    value={createUserForm.confirmPassword}
                    onChange={(event) =>
                      updateCreateUserForm(
                        "confirmPassword",
                        event.target.value,
                      )
                    }
                    aria-invalid={Boolean(createUserErrors.confirmPassword)}
                  />
                  {createUserErrors.confirmPassword ? (
                    <p className="text-destructive text-sm">
                      {createUserErrors.confirmPassword}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {userModalAction === "view-user" && selectedUser ? (
            <div className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {selectedUser.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {selectedUser.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span>{" "}
                {selectedUser.phoneNumber ?? "-"}
              </p>
              <p>
                <span className="font-medium">Role:</span>{" "}
                {getRoleLabel(selectedUser.role)}
              </p>
              <p>
                <span className="font-medium">Team:</span>{" "}
                {selectedUser.teamName ?? "Unassigned"}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {selectedUser.status}
              </p>
              <p className="sm:col-span-2">
                <span className="font-medium">Login portal:</span>{" "}
                <code className="bg-muted rounded px-2 py-1 text-xs">
                  {selectedUser.loginPath}
                </code>
              </p>
            </div>
          ) : null}

          {userModalAction === "reset-password" && selectedUser ? (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-md border p-4 text-sm">
                <p className="font-medium">{selectedUser.fullName}</p>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <p className="text-muted-foreground">
                  {getRoleLabel(selectedUser.role)} -{" "}
                  {selectedUser.teamName ?? "Unassigned"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reset-user-password">New Password</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={fillGeneratedResetPassword}
                    >
                      Generate
                    </Button>
                  </div>
                  <Input
                    id="reset-user-password"
                    type="password"
                    value={passwordForm.password}
                    onChange={(event) =>
                      updatePasswordForm("password", event.target.value)
                    }
                    aria-invalid={Boolean(passwordErrors.password)}
                  />
                  {passwordErrors.password ? (
                    <p className="text-destructive text-sm">
                      {passwordErrors.password}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-user-confirm-password">
                    Confirm Password
                  </Label>
                  <Input
                    id="reset-user-confirm-password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      updatePasswordForm("confirmPassword", event.target.value)
                    }
                    aria-invalid={Boolean(passwordErrors.confirmPassword)}
                  />
                  {passwordErrors.confirmPassword ? (
                    <p className="text-destructive text-sm">
                      {passwordErrors.confirmPassword}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeUserModal}>
              {userModalAction === "view-user" ? "Close" : "Cancel"}
            </Button>

            {userModalAction === "view-user" && selectedUser?.hasAuthUser ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPasswordForm(createDefaultPasswordForm());
                  setPasswordErrors({});
                  setUserModalError(null);
                  setUserModalAction("reset-password");
                }}
              >
                <KeyRound className="size-4" />
                Reset Password
              </Button>
            ) : null}

            {userModalAction === "create" ? (
              <Button
                type="button"
                onClick={handleCreateUser}
                disabled={isUserSubmitting || teams.length === 0}
              >
                {isUserSubmitting ? "Creating..." : "Create User"}
              </Button>
            ) : null}

            {userModalAction === "reset-password" ? (
              <Button
                type="button"
                onClick={handleResetUserPassword}
                disabled={isUserSubmitting}
              >
                {isUserSubmitting ? "Resetting..." : "Reset Password"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={credentialConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialConfirmation(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{credentialConfirmation?.title}</DialogTitle>
            <DialogDescription>
              {credentialConfirmation?.description}
            </DialogDescription>
          </DialogHeader>

          {credentialConfirmation ? (
            <div className="bg-muted/40 space-y-3 rounded-md border p-4 text-sm">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {credentialConfirmation.fullName}
              </p>
              <div className="flex items-center justify-between gap-3">
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {credentialConfirmation.email}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyCredentialText(
                      credentialConfirmation.email,
                      "Email",
                    )
                  }
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p>
                  <span className="font-medium">Password:</span>{" "}
                  <code className="bg-background rounded px-2 py-1 font-mono text-xs">
                    {credentialConfirmation.password}
                  </code>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyCredentialText(
                      credentialConfirmation.password,
                      "Password",
                    )
                  }
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
              <p>
                <span className="font-medium">Role:</span>{" "}
                {getRoleLabel(credentialConfirmation.role)}
              </p>
              <p>
                <span className="font-medium">Login portal:</span>{" "}
                <code className="bg-background rounded px-2 py-1 text-xs">
                  {credentialConfirmation.loginPath}
                </code>
              </p>
              <p className="text-muted-foreground text-xs">
                Store or share these credentials securely. The password will not
                be shown again after this dialog closes.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setCredentialConfirmation(null)}
            >
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
