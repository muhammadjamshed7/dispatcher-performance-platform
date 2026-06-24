import "server-only";

import type {
  Carrier,
  DailyActivity,
  Dispatcher,
  RegistrationRequest,
  Team,
  User,
} from "@/lib/db/types";
import { decimalToNumber, toIsoString } from "@/lib/db/utils";
import type {
  Carrier as CarrierDto,
  DailyActivity as DailyActivityDto,
  Dispatcher as DispatcherDto,
  PendingUserRequest,
  Team as TeamDto,
  User as UserDto,
} from "@/lib/types";

export function mapTeam(
  team: Team & {
    _count?: { dispatchers: number; carriers: number };
    teamLead?: { fullName: string } | null;
  },
): TeamDto {
  return {
    id: team.id,
    name: team.name,
    teamLeadName: team.teamLead?.fullName ?? "Unassigned",
    status: team.status,
    dispatchersCount: team._count?.dispatchers ?? 0,
    carriersCount: team._count?.carriers ?? 0,
    createdAt: toIsoString(team.createdAt),
  };
}

export function mapDispatcher(
  dispatcher: Dispatcher & {
    user: Pick<User, "fullName" | "email" | "phoneNumber" | "role">;
    team: Pick<Team, "name">;
    _count?: { carriers: number };
  },
): DispatcherDto {
  return {
    id: dispatcher.id,
    fullName: dispatcher.user.fullName,
    email: dispatcher.user.email,
    phoneNumber: dispatcher.user.phoneNumber ?? "",
    teamName: dispatcher.team.name,
    role: dispatcher.user.role === "TEAM_LEAD" ? "TEAM_LEAD" : "DISPATCHER",
    status: dispatcher.status,
    assignedCarriersCount: dispatcher._count?.carriers ?? 0,
    createdAt: toIsoString(dispatcher.createdAt),
  };
}

export function mapCarrier(
  carrier: Carrier & {
    team: Pick<Team, "name">;
    dispatcher?: { user: Pick<User, "fullName"> } | null;
  },
): CarrierDto {
  return {
    id: carrier.id,
    carrierName: carrier.carrierName,
    driverName: carrier.driverName,
    mcNumber: carrier.mcNumber,
    truckType: carrier.truckType,
    assignedTeamId: carrier.teamId,
    assignedTeamName: carrier.team.name,
    assignedDispatcherId: carrier.dispatcherId,
    assignedDispatcherName: carrier.dispatcher?.user.fullName ?? "Unassigned",
    dispatchFeePercentage: decimalToNumber(carrier.dispatchFeePercentage) ?? 0,
    status: carrier.status,
    createdAt: toIsoString(carrier.createdAt),
  };
}

export function mapDailyActivity(activity: DailyActivity): DailyActivityDto {
  return {
    id: activity.id,
    date: toIsoString(activity.activityDate).slice(0, 10),
    carrierId: activity.carrierId,
    carrierName: activity.carrierNameSnapshot,
    dispatcherId: activity.dispatcherId,
    dispatcherName: activity.dispatcherNameSnapshot,
    teamId: activity.teamId,
    teamName: activity.teamNameSnapshot,
    truckType: activity.truckTypeSnapshot,
    status: activity.status,
    origin: activity.origin,
    destination: activity.destination,
    miles: decimalToNumber(activity.totalMiles),
    loadAmount: decimalToNumber(activity.loadAmount),
    ratePerMile: decimalToNumber(activity.ratePerMile),
    dispatchFee: decimalToNumber(activity.dispatchFee),
    reason: activity.reason,
    notes: activity.notes,
  };
}

export function mapRegistrationRequest(
  request: RegistrationRequest,
): PendingUserRequest {
  return {
    id: request.id,
    fullName: request.fullName,
    email: request.email,
    phoneNumber: request.phoneNumber,
    requestedRole:
      request.requestedRole === "TEAM_LEAD" ? "TEAM_LEAD" : "DISPATCHER",
    preferredTeam: request.preferredTeamName,
    status:
      request.status === "PENDING"
        ? "PENDING_APPROVAL"
        : request.status === "APPROVED"
          ? "ACTIVE"
          : "INACTIVE",
    submittedAt: toIsoString(request.submittedAt),
    notes: request.notes ?? undefined,
  };
}

export function mapUser(
  user: User & {
    team?: { name: string } | null;
    dispatcher?: { id: string } | null;
  },
): UserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    teamId: user.teamId,
    teamName: user.team?.name,
    dispatcherId: user.dispatcher?.id ?? null,
    phoneNumber: user.phoneNumber ?? undefined,
  };
}
