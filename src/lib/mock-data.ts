import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import {
  DELIVERED,
  CANCELLED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import {
  FLATBED,
  DRY_VAN,
  REEFER,
  BOX_TRUCK,
  HOTSHOT,
} from "@/lib/constants/truck-types";
import type {
  AppSettings,
  Carrier,
  CarrierRanking,
  CarrierReportRow,
  DailyActivity,
  DashboardMetric,
  DateRangeOption,
  Dispatcher,
  DispatcherRanking,
  DispatcherReportRow,
  FilterOption,
  ReportBundle,
  ReportSummary,
  Team,
  TeamRanking,
  TeamReportRow,
  User,
  PendingUserRequest,
} from "@/lib/types";
import { ADMIN } from "@/lib/constants/roles";
import { ACTIVE, PENDING_APPROVAL } from "@/lib/auth/user-statuses";

export type {
  AppSettings,
  Carrier,
  CarrierRanking,
  CarrierReportRow,
  DailyActivity,
  DashboardMetric,
  DateRangeOption,
  Dispatcher,
  DispatcherRanking,
  DispatcherReportRow,
  FilterOption,
  LoadActivityStatus,
  RankingRow,
  ReportBundle,
  ReportRow,
  ReportSummary,
  RoleScope,
  Status,
  StatusReason,
  Team,
  TeamRanking,
  TeamReportRow,
  TruckType,
  User,
  UserRole,
  UserStatus,
  PendingUserRequest,
} from "@/lib/types";

export const mockAdminUser: User = {
  id: "user-admin",
  fullName: "Alex Morgan",
  email: "alex.morgan@example.com",
  role: ADMIN,
  status: ACTIVE,
  teamId: null,
  dispatcherId: null,
};

export const mockTeamLeadUser: User = {
  id: "user-team-lead",
  fullName: "Jordan Lee",
  email: "jordan.lee@example.com",
  role: TEAM_LEAD,
  status: ACTIVE,
  teamId: "team-1",
  teamName: "Midwest Ops",
  dispatcherId: null,
};

export const mockDispatcherUser: User = {
  id: "user-dispatcher",
  fullName: "Sam Rivera",
  email: "sam.rivera@example.com",
  role: DISPATCHER,
  status: ACTIVE,
  teamId: "team-1",
  teamName: "Midwest Ops",
  dispatcherId: "disp-1",
};

export const mockUsers: User[] = [
  mockAdminUser,
  mockTeamLeadUser,
  mockDispatcherUser,
  {
    id: "user-team-lead-2",
    fullName: "Taylor Brooks",
    email: "taylor.brooks@example.com",
    role: TEAM_LEAD,
    status: ACTIVE,
    teamId: "team-2",
    teamName: "Southeast Fleet",
    dispatcherId: null,
  },
  {
    id: "user-dispatcher-2",
    fullName: "Avery Chen",
    email: "avery.chen@example.com",
    role: DISPATCHER,
    status: ACTIVE,
    teamId: "team-4",
    teamName: "Northern Express",
    dispatcherId: "disp-5",
  },
];

export const mockPendingUserRequests: PendingUserRequest[] = [
  {
    id: "req-1",
    fullName: "Chris Dalton",
    email: "chris.dalton@example.com",
    phoneNumber: "+1 (313) 555-0188",
    requestedRole: DISPATCHER,
    preferredTeam: "Midwest Ops",
    status: PENDING_APPROVAL,
    submittedAt: "2026-06-18T14:20:00.000Z",
    notes: "Experienced hotshot dispatcher.",
  },
  {
    id: "req-2",
    fullName: "Priya Shah",
    email: "priya.shah@example.com",
    phoneNumber: "+1 (612) 555-0133",
    requestedRole: TEAM_LEAD,
    preferredTeam: "Northern Express",
    status: PENDING_APPROVAL,
    submittedAt: "2026-06-17T09:45:00.000Z",
  },
  {
    id: "req-3",
    fullName: "Marcus Hill",
    email: "marcus.hill@example.com",
    phoneNumber: "+1 (404) 555-0198",
    requestedRole: DISPATCHER,
    preferredTeam: "Southeast Fleet",
    status: PENDING_APPROVAL,
    submittedAt: "2026-06-16T16:10:00.000Z",
    notes: "Referred by existing carrier partner.",
  },
];

export function getMockUserForRole(role: typeof ADMIN | typeof TEAM_LEAD | typeof DISPATCHER): User {
  if (role === ADMIN) {
    return mockAdminUser;
  }

  if (role === TEAM_LEAD) {
    return mockTeamLeadUser;
  }

  return mockDispatcherUser;
}

export const mockStatusReasons: string[] = [
  "Driver unavailable for scheduled pickup",
  "Shipper cancelled load after rate confirmation",
  "No suitable freight available for lane",
  "Equipment breakdown",
  "Rate negotiation failed",
  "Customer rescheduled pickup",
];

export const mockTruckTypes = [DRY_VAN, REEFER, FLATBED, BOX_TRUCK, HOTSHOT] as const;

export const mockTeams: Team[] = [
  {
    id: "team-1",
    name: "Midwest Ops",
    teamLeadName: "Jordan Lee",
    status: TEAM_STATUS_ACTIVE,
    dispatchersCount: 6,
    carriersCount: 18,
    createdAt: "2025-11-04T10:00:00.000Z",
  },
  {
    id: "team-2",
    name: "Southeast Fleet",
    teamLeadName: "Avery Chen",
    status: TEAM_STATUS_ACTIVE,
    dispatchersCount: 4,
    carriersCount: 12,
    createdAt: "2025-12-12T14:30:00.000Z",
  },
  {
    id: "team-3",
    name: "West Coast Line",
    teamLeadName: "Morgan Patel",
    status: TEAM_STATUS_INACTIVE,
    dispatchersCount: 5,
    carriersCount: 9,
    createdAt: "2026-01-20T09:15:00.000Z",
  },
  {
    id: "team-4",
    name: "Northern Express",
    teamLeadName: "Riley Santos",
    status: TEAM_STATUS_ACTIVE,
    dispatchersCount: 3,
    carriersCount: 7,
    createdAt: "2026-02-08T16:45:00.000Z",
  },
];

export const mockDispatchers: Dispatcher[] = [
  {
    id: "disp-1",
    fullName: "Sam Rivera",
    email: "sam.rivera@example.com",
    phoneNumber: "+1 (312) 555-0142",
    teamName: "Midwest Ops",
    role: DISPATCHER,
    status: TEAM_STATUS_ACTIVE,
    assignedCarriersCount: 8,
    createdAt: "2025-10-15T08:00:00.000Z",
  },
  {
    id: "disp-2",
    fullName: "Taylor Brooks",
    email: "taylor.brooks@example.com",
    phoneNumber: "+1 (404) 555-0198",
    teamName: "Southeast Fleet",
    role: TEAM_LEAD,
    status: TEAM_STATUS_ACTIVE,
    assignedCarriersCount: 12,
    createdAt: "2025-11-02T11:30:00.000Z",
  },
  {
    id: "disp-3",
    fullName: "Casey Nguyen",
    email: "casey.nguyen@example.com",
    phoneNumber: "+1 (213) 555-0176",
    teamName: "West Coast Line",
    role: DISPATCHER,
    status: TEAM_STATUS_INACTIVE,
    assignedCarriersCount: 0,
    createdAt: "2025-12-20T09:45:00.000Z",
  },
  {
    id: "disp-4",
    fullName: "Jordan Lee",
    email: "jordan.lee@example.com",
    phoneNumber: "+1 (612) 555-0133",
    teamName: "Midwest Ops",
    role: TEAM_LEAD,
    status: TEAM_STATUS_ACTIVE,
    assignedCarriersCount: 10,
    createdAt: "2026-01-08T14:00:00.000Z",
  },
  {
    id: "disp-5",
    fullName: "Avery Chen",
    email: "avery.chen@example.com",
    phoneNumber: "+1 (678) 555-0165",
    teamName: "Northern Express",
    role: DISPATCHER,
    status: TEAM_STATUS_ACTIVE,
    assignedCarriersCount: 5,
    createdAt: "2026-02-14T10:20:00.000Z",
  },
];

export const mockCarriers: Carrier[] = [
  {
    id: "car-1",
    carrierName: "Summit Freight LLC",
    driverName: "Marcus Hill",
    mcNumber: "MC-482910",
    truckType: DRY_VAN,
    assignedTeamName: "Midwest Ops",
    assignedDispatcherName: "Sam Rivera",
    dispatchFeePercentage: 12,
    status: TEAM_STATUS_ACTIVE,
    notes: "Preferred Midwest lanes.",
    createdAt: "2025-09-10T10:00:00.000Z",
  },
  {
    id: "car-2",
    carrierName: "Blue Ridge Transport",
    driverName: "Elena Price",
    mcNumber: "MC-773204",
    truckType: REEFER,
    assignedTeamName: "Southeast Fleet",
    assignedDispatcherName: "Taylor Brooks",
    dispatchFeePercentage: 10,
    status: TEAM_STATUS_ACTIVE,
    createdAt: "2025-10-22T14:30:00.000Z",
  },
  {
    id: "car-3",
    carrierName: "Ironclad Logistics",
    driverName: "Devon Walsh",
    mcNumber: "MC-119845",
    truckType: FLATBED,
    assignedTeamName: "West Coast Line",
    assignedDispatcherName: "Casey Nguyen",
    dispatchFeePercentage: 8,
    status: TEAM_STATUS_INACTIVE,
    notes: "Paused until Q3 capacity returns.",
    createdAt: "2025-11-18T09:15:00.000Z",
  },
  {
    id: "car-4",
    carrierName: "Northern Haul Co",
    driverName: "Priya Shah",
    mcNumber: "MC-334512",
    truckType: BOX_TRUCK,
    assignedTeamName: "Northern Express",
    assignedDispatcherName: "Avery Chen",
    dispatchFeePercentage: 15,
    status: TEAM_STATUS_ACTIVE,
    createdAt: "2026-01-05T11:00:00.000Z",
  },
  {
    id: "car-5",
    carrierName: "Swift Hotshot LLC",
    driverName: "Chris Dalton",
    mcNumber: "MC-902118",
    truckType: HOTSHOT,
    assignedTeamName: "Midwest Ops",
    assignedDispatcherName: "Jordan Lee",
    dispatchFeePercentage: 18,
    status: TEAM_STATUS_ACTIVE,
    createdAt: "2026-02-28T08:45:00.000Z",
  },
];

export const mockActivities: DailyActivity[] = [
  {
    id: "act-1",
    date: "2026-06-19",
    carrierName: "Summit Freight LLC",
    dispatcherName: "Sam Rivera",
    teamName: "Midwest Ops",
    truckType: DRY_VAN,
    status: DELIVERED,
    origin: "Chicago, IL",
    destination: "Dallas, TX",
    miles: 925,
    loadAmount: 3200,
    ratePerMile: 3.46,
    dispatchFee: 384,
    reason: null,
    notes: "On-time delivery.",
  },
  {
    id: "act-2",
    date: "2026-06-19",
    carrierName: "Blue Ridge Transport",
    dispatcherName: "Taylor Brooks",
    teamName: "Southeast Fleet",
    truckType: REEFER,
    status: NOT_WORKING,
    origin: null,
    destination: null,
    miles: null,
    loadAmount: null,
    ratePerMile: null,
    dispatchFee: null,
    reason: "Driver unavailable for scheduled pickup.",
    notes: "Follow up tomorrow.",
  },
  {
    id: "act-3",
    date: "2026-06-18",
    carrierName: "Ironclad Logistics",
    dispatcherName: "Casey Nguyen",
    teamName: "West Coast Line",
    truckType: FLATBED,
    status: CANCELLED,
    origin: null,
    destination: null,
    miles: null,
    loadAmount: null,
    ratePerMile: null,
    dispatchFee: null,
    reason: "Shipper cancelled load after rate confirmation.",
    notes: null,
  },
  {
    id: "act-4",
    date: "2026-06-18",
    carrierName: "Northern Haul Co",
    dispatcherName: "Avery Chen",
    teamName: "Northern Express",
    truckType: BOX_TRUCK,
    status: NOT_BOOKED,
    origin: null,
    destination: null,
    miles: null,
    loadAmount: null,
    ratePerMile: null,
    dispatchFee: null,
    reason: "No suitable freight available for lane.",
    notes: "Retry booking next week.",
  },
  {
    id: "act-5",
    date: "2026-06-17",
    carrierName: "Swift Hotshot LLC",
    dispatcherName: "Jordan Lee",
    teamName: "Midwest Ops",
    truckType: HOTSHOT,
    status: DELIVERED,
    origin: "Detroit, MI",
    destination: "Indianapolis, IN",
    miles: 290,
    loadAmount: 1450,
    ratePerMile: 5.0,
    dispatchFee: 261,
    reason: null,
    notes: "Hotshot expedited load.",
  },
];

export const mockMetrics: DashboardMetric = {
  totalRevenue: 259300,
  totalLoads: 105,
  deliveredLoads: 78,
  avgRatePerMile: 2.84,
  activeDispatchers: 12,
};

export const mockAdminMetrics: DashboardMetric = {
  ...mockMetrics,
  totalRevenue: 892400,
  totalLoads: 412,
};

export const mockTeamLeadMetrics: DashboardMetric = {
  totalRevenue: 312800,
  totalLoads: 128,
  deliveredLoads: 96,
  avgRatePerMile: 2.91,
  activeDispatchers: 6,
};

export const mockDispatcherMetrics: DashboardMetric = {
  totalRevenue: 48200,
  totalLoads: 18,
  deliveredLoads: 14,
  avgRatePerMile: 2.76,
  activeDispatchers: 1,
};

export type MockReportSummary = ReportSummary;
export type MockDailyReportRow = DailyActivity;
export type MockDispatcherReportRow = DispatcherReportRow;
export type MockCarrierReportRow = CarrierReportRow;
export type MockTeamReportRow = TeamReportRow;
export type MockReportBundle = ReportBundle;
export type MockAppSettings = AppSettings;
export type MockMetrics = DashboardMetric;
export type MockTeam = Team;
export type MockDispatcher = Dispatcher;
export type MockCarrier = Carrier;
export type MockActivity = DailyActivity;

const mockDispatcherReportRows: DispatcherReportRow[] = [
  {
    id: "dr-1",
    dispatcherName: "Sam Rivera",
    teamName: "Midwest Ops",
    deliveredLoads: 18,
    cancelledLoads: 2,
    notBookedCount: 1,
    notWorkingCount: 1,
    revenue: 48200,
    dispatchFees: 5784,
    averageRatePerMile: 3.12,
    cancellationRate: 9.1,
    bookingEfficiency: 85.7,
  },
  {
    id: "dr-2",
    dispatcherName: "Taylor Brooks",
    teamName: "Southeast Fleet",
    deliveredLoads: 14,
    cancelledLoads: 3,
    notBookedCount: 2,
    notWorkingCount: 2,
    revenue: 36800,
    dispatchFees: 3680,
    averageRatePerMile: 2.94,
    cancellationRate: 14.3,
    bookingEfficiency: 77.8,
  },
  {
    id: "dr-3",
    dispatcherName: "Jordan Lee",
    teamName: "Midwest Ops",
    deliveredLoads: 22,
    cancelledLoads: 1,
    notBookedCount: 0,
    notWorkingCount: 1,
    revenue: 61200,
    dispatchFees: 11016,
    averageRatePerMile: 3.28,
    cancellationRate: 4.2,
    bookingEfficiency: 91.7,
  },
];

const mockCarrierReportRows: CarrierReportRow[] = [
  {
    id: "cr-1",
    carrierName: "Summit Freight LLC",
    driverName: "Marcus Hill",
    mcNumber: "MC-482910",
    dispatcherName: "Sam Rivera",
    teamName: "Midwest Ops",
    truckType: DRY_VAN,
    deliveredLoads: 12,
    cancelledLoads: 1,
    notBookedCount: 0,
    notWorkingCount: 0,
    revenue: 38400,
    dispatchFees: 4608,
    averageRatePerMile: 3.18,
    activityScore: 92,
  },
  {
    id: "cr-2",
    carrierName: "Blue Ridge Transport",
    driverName: "Elena Price",
    mcNumber: "MC-773204",
    dispatcherName: "Taylor Brooks",
    teamName: "Southeast Fleet",
    truckType: REEFER,
    deliveredLoads: 9,
    cancelledLoads: 2,
    notBookedCount: 1,
    notWorkingCount: 1,
    revenue: 27100,
    dispatchFees: 2710,
    averageRatePerMile: 2.86,
    activityScore: 78,
  },
  {
    id: "cr-3",
    carrierName: "Swift Hotshot LLC",
    driverName: "Chris Dalton",
    mcNumber: "MC-902118",
    dispatcherName: "Jordan Lee",
    teamName: "Midwest Ops",
    truckType: HOTSHOT,
    deliveredLoads: 8,
    cancelledLoads: 0,
    notBookedCount: 0,
    notWorkingCount: 0,
    revenue: 19800,
    dispatchFees: 3564,
    averageRatePerMile: 4.95,
    activityScore: 96,
  },
];

const mockTeamReportRows: TeamReportRow[] = [
  {
    id: "tr-1",
    teamName: "Midwest Ops",
    teamLeadName: "Jordan Lee",
    dispatchers: 6,
    activeCarriers: 18,
    deliveredLoads: 42,
    cancelledLoads: 4,
    revenue: 124500,
    dispatchFees: 18675,
    averageRatePerMile: 3.08,
    cancellationRate: 8.7,
    teamRank: 1,
  },
  {
    id: "tr-2",
    teamName: "Southeast Fleet",
    teamLeadName: "Avery Chen",
    dispatchers: 4,
    activeCarriers: 12,
    deliveredLoads: 28,
    cancelledLoads: 6,
    revenue: 89200,
    dispatchFees: 8920,
    averageRatePerMile: 2.81,
    cancellationRate: 17.6,
    teamRank: 3,
  },
  {
    id: "tr-3",
    teamName: "Northern Express",
    teamLeadName: "Riley Santos",
    dispatchers: 3,
    activeCarriers: 7,
    deliveredLoads: 19,
    cancelledLoads: 2,
    revenue: 56800,
    dispatchFees: 8520,
    averageRatePerMile: 2.97,
    cancellationRate: 9.5,
    teamRank: 2,
  },
];

function buildReportBundle(
  summary: ReportSummary,
  daily: DailyActivity[],
): ReportBundle {
  return {
    summary,
    daily,
    dispatchers: mockDispatcherReportRows,
    carriers: mockCarrierReportRows,
    teams: mockTeamReportRows,
  };
}

export const mockDailyReport: ReportBundle = buildReportBundle(
  {
    revenue: 4650,
    dispatchFees: 645,
    deliveredLoads: 2,
    cancelledLoads: 1,
    activeCarriers: 4,
  },
  mockActivities,
);

export const mockWeeklyReport: ReportBundle = buildReportBundle(
  {
    revenue: 28400,
    dispatchFees: 3420,
    deliveredLoads: 11,
    cancelledLoads: 3,
    activeCarriers: 5,
  },
  mockActivities,
);

export const mockMonthlyReport: ReportBundle = buildReportBundle(
  {
    revenue: 112800,
    dispatchFees: 13536,
    deliveredLoads: 46,
    cancelledLoads: 9,
    activeCarriers: 5,
  },
  mockActivities,
);

export const mockHistoricalReport: ReportBundle = buildReportBundle(
  {
    revenue: 892400,
    dispatchFees: 98420,
    deliveredLoads: 312,
    cancelledLoads: 48,
    activeCarriers: 5,
  },
  mockActivities,
);

export const MOCK_FILTER_ALL = "all";

export const MOCK_DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { value: "today", label: "Today" },
  { value: "last-7-days", label: "Last 7 days" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
];

export const mockFilterTeams: FilterOption[] = mockTeams.map(({ id, name }) => ({
  id,
  label: name,
}));

export const mockFilterDispatchers: FilterOption[] = mockDispatchers.map(
  ({ id, fullName }) => ({
    id,
    label: fullName,
  }),
);

export const mockFilterCarriers: FilterOption[] = mockCarriers.map(
  ({ id, carrierName }) => ({
    id,
    label: carrierName,
  }),
);

export const mockDispatcherRankings: DispatcherRanking[] = [...mockDispatchers]
  .sort((a, b) => b.assignedCarriersCount - a.assignedCarriersCount)
  .map((dispatcher, index) => ({
    rank: index + 1,
    name: dispatcher.fullName,
    team: dispatcher.teamName,
    carriers: dispatcher.assignedCarriersCount,
  }));

export const mockCarrierRankings: CarrierRanking[] = [...mockCarrierReportRows]
  .sort((a, b) => b.activityScore - a.activityScore)
  .map((carrier, index) => ({
    rank: index + 1,
    carrierName: carrier.carrierName,
    dispatcherName: carrier.dispatcherName,
    activityScore: carrier.activityScore,
  }));

export const mockTeamRankings: TeamRanking[] = [...mockTeamReportRows]
  .sort((a, b) => a.teamRank - b.teamRank)
  .map((team) => ({
    rank: team.teamRank,
    teamName: team.teamName,
    teamLeadName: team.teamLeadName,
    revenue: team.revenue,
  }));

export const mockAppSettings: AppSettings = {
  dispatchFeeCalculation: {
    method: "Percentage of load amount",
    defaultPercentage: 12,
    minimumFee: 25,
    roundToNearestDollar: true,
  },
  allowedTruckTypes: [...mockTruckTypes],
  allowedStatusReasons: mockStatusReasons,
  timezone: "America/Chicago",
  csvExport: {
    includeHeaders: true,
    dateFormat: "YYYY-MM-DD",
    maxRows: 10000,
    fileNamePrefix: "dispatcher-report",
  },
};
