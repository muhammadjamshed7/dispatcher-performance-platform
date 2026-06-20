"use client";

import { useMemo, useState } from "react";
import { Eye, MoreHorizontal } from "lucide-react";

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
import { mockPendingUserRequests, mockTeams } from "@/lib/mock-data";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format-date";
import type { PendingUserRequest } from "@/lib/types";

type ModalAction =
  | "view"
  | "approve"
  | "reject"
  | "assign-role"
  | "assign-team"
  | null;

export function UserRequestsPageContent() {
  const [requests, setRequests] = useState(mockPendingUserRequests);
  const [selectedRequest, setSelectedRequest] = useState<PendingUserRequest | null>(
    null,
  );
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [assignedRole, setAssignedRole] = useState<string>(DISPATCHER);
  const [assignedTeam, setAssignedTeam] = useState<string>("");

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING_APPROVAL").length,
    [requests],
  );

  const openModal = (request: PendingUserRequest, action: ModalAction) => {
    setSelectedRequest(request);
    setModalAction(action);
    setAssignedRole(request.requestedRole);
    setAssignedTeam(request.preferredTeam ?? "");
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setModalAction(null);
  };

  const handleMockAction = () => {
    if (!selectedRequest) {
      return;
    }

    if (modalAction === "approve") {
      setRequests((current) =>
        current.filter((request) => request.id !== selectedRequest.id),
      );
    }

    if (modalAction === "reject") {
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id
            ? { ...request, status: "INACTIVE" as const }
            : request,
        ),
      );
    }

    closeModal();
  };

  const modalTitle = (() => {
    switch (modalAction) {
      case "view":
        return "Registration Request Details";
      case "approve":
        return "Approve User Request";
      case "reject":
        return "Reject User Request";
      case "assign-role":
        return "Assign Role";
      case "assign-team":
        return "Assign Team";
      default:
        return "";
    }
  })();

  return (
    <PageShell
      title="User Requests"
      description="Review pending registration and role assignment requests (mock UI only)."
    >
      <RoleScopeBanner message="Admin approval queue · mock data" />

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">
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
                  <TableCell className="font-medium">{request.fullName}</TableCell>
                  <TableCell>{request.email}</TableCell>
                  <TableCell>{request.phoneNumber}</TableCell>
                  <TableCell>{request.requestedRole.replaceAll("_", " ")}</TableCell>
                  <TableCell>{request.preferredTeam ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell>{formatDate(request.submittedAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" type="button" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openModal(request, "view")}>
                          <Eye className="mr-2 size-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openModal(request, "approve")}>
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openModal(request, "reject")}>
                          Reject
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openModal(request, "assign-role")}>
                          Assign Role
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openModal(request, "assign-team")}>
                          Assign Team
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

      <Dialog open={modalAction !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              Mock modal — no data is saved until backend integration.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Name:</span> {selectedRequest.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {selectedRequest.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {selectedRequest.phoneNumber}
              </p>
              <p>
                <span className="font-medium">Requested role:</span>{" "}
                {selectedRequest.requestedRole.replaceAll("_", " ")}
              </p>
              {selectedRequest.notes ? (
                <p>
                  <span className="font-medium">Notes:</span> {selectedRequest.notes}
                </p>
              ) : null}

              {modalAction === "assign-role" ? (
                <div className="space-y-2">
                  <p className="font-medium">Select role</p>
                  <Select
                    value={assignedRole}
                    onValueChange={(value) => setAssignedRole(value ?? DISPATCHER)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TEAM_LEAD}>Team Lead</SelectItem>
                      <SelectItem value={DISPATCHER}>Dispatcher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {modalAction === "assign-team" ? (
                <div className="space-y-2">
                  <p className="font-medium">Select team</p>
                  <Select
                    value={assignedTeam}
                    onValueChange={(value) => setAssignedTeam(value ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose team" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockTeams.map((team) => (
                        <SelectItem key={team.id} value={team.name}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            {modalAction !== "view" ? (
              <Button type="button" onClick={handleMockAction}>
                Confirm (mock)
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
