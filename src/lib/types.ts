import type { Role } from "@/lib/constants/roles";
import type { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import type { Status } from "@/lib/constants/statuses";
import type { TeamStatus } from "@/lib/constants/team-statuses";
import type { TruckType } from "@/lib/constants/truck-types";
import type { UserStatus as AuthUserStatus } from "@/lib/auth/user-statuses";

export type UserRole = Role;
export type UserStatus = AuthUserStatus;
export type LoadActivityStatus = Status;
export type { Status, TruckType };

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  teamId?: string | null;
  teamName?: string;
  dispatcherId?: string | null;
  phoneNumber?: string;
};

export type PendingUserRequest = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  requestedRole: typeof DISPATCHER | typeof TEAM_LEAD;
  preferredTeam: string | null;
  status: UserStatus;
  submittedAt: string;
  notes?: string;
};

export type Team = {
  id: string;
  name: string;
  teamLeadName: string;
  status: TeamStatus;
  dispatchersCount: number;
  carriersCount: number;
  createdAt: string;
};

export type Dispatcher = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  teamName: string;
  role: typeof DISPATCHER | typeof TEAM_LEAD;
  status: TeamStatus;
  assignedCarriersCount: number;
  createdAt: string;
};

export type Carrier = {
  id: string;
  carrierName: string;
  driverName: string;
  mcNumber: string;
  truckType: TruckType;
  assignedTeamName: string;
  assignedDispatcherName: string;
  dispatchFeePercentage: number;
  status: TeamStatus;
  notes?: string;
  createdAt: string;
};

export type DailyActivity = {
  id: string;
  date: string;
  carrierName: string;
  dispatcherName: string;
  teamName: string;
  truckType: TruckType;
  status: LoadActivityStatus;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  loadAmount: number | null;
  ratePerMile: number | null;
  dispatchFee: number | null;
  reason: string | null;
  notes: string | null;
};

export type StatusReason = string;

export type DashboardMetric = {
  totalRevenue: number;
  totalLoads: number;
  deliveredLoads: number;
  avgRatePerMile: number;
  activeDispatchers: number;
};

export type AdminDashboardGrowth = {
  revenue: number | null;
  loads: number | null;
  delivered: number | null;
  dispatchers: number | null;
  onTimeRate: number | null;
  monthlyGrowth: number | null;
};

export type AdminDashboardMetrics = {
  totalRevenue: number;
  totalLoads: number;
  deliveredLoads: number;
  activeDispatchers: number;
  onTimeRate: number;
  monthlyGrowth: number;
  growth: AdminDashboardGrowth;
  sparklines: {
    revenue: number[];
    loads: number[];
    delivered: number[];
  };
};

export type AdminDashboardBundle = {
  filters: {
    dateFrom: string;
    dateTo: string;
    teamId: string | null;
    dispatcherId: string | null;
    carrierId: string | null;
    truckType: string | null;
    status: string | null;
  };
  metrics: AdminDashboardMetrics;
  revenueTrend: { date: string; revenue: number }[];
  loadsByTeam: { team: string; loads: number }[];
  statusBreakdown: {
    name: string;
    value: number;
    percent: string;
    color: string;
  }[];
  topPerformers: {
    rank: number;
    name: string;
    initials: string;
    team: string;
    revenue: number;
  }[];
  recentActivities: {
    id: string;
    dateTime: string;
    dispatcher: string;
    initials: string;
    carrier: string;
    loadId: string;
    route: string;
    truckType: string;
    status: string;
    amount: number;
  }[];
  filterOptions: {
    teams: { id: string; name: string }[];
    dispatchers: { id: string; name: string; teamId: string }[];
    carriers: { id: string; name: string }[];
    truckTypes: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
  };
};

export type DispatcherRanking = {
  rank: number;
  name: string;
  team: string;
  carriers: number;
};

export type CarrierRanking = {
  rank: number;
  carrierName: string;
  dispatcherName: string;
  activityScore: number;
};

export type TeamRanking = {
  rank: number;
  teamName: string;
  teamLeadName: string;
  revenue: number;
};

export type RankingRow = DispatcherRanking | CarrierRanking | TeamRanking;

export type ReportSummary = {
  revenue: number;
  dispatchFees: number;
  deliveredLoads: number;
  cancelledLoads: number;
  activeCarriers: number;
};

export type DispatcherReportRow = {
  id: string;
  dispatcherName: string;
  teamName: string;
  deliveredLoads: number;
  cancelledLoads: number;
  notBookedCount: number;
  notWorkingCount: number;
  revenue: number;
  dispatchFees: number;
  averageRatePerMile: number | null;
  cancellationRate: number;
  bookingEfficiency: number;
};

export type CarrierReportRow = {
  id: string;
  carrierName: string;
  driverName: string;
  mcNumber: string;
  dispatcherName: string;
  teamName: string;
  truckType: TruckType;
  deliveredLoads: number;
  cancelledLoads: number;
  notBookedCount: number;
  notWorkingCount: number;
  revenue: number;
  dispatchFees: number;
  averageRatePerMile: number | null;
  activityScore: number;
};

export type TeamReportRow = {
  id: string;
  teamName: string;
  teamLeadName: string;
  dispatchers: number;
  activeCarriers: number;
  deliveredLoads: number;
  cancelledLoads: number;
  revenue: number;
  dispatchFees: number;
  averageRatePerMile: number | null;
  cancellationRate: number;
  teamRank: number;
};

export type ReportRow =
  | DailyActivity
  | DispatcherReportRow
  | CarrierReportRow
  | TeamReportRow;

export type ReportBundle = {
  summary: ReportSummary;
  daily: DailyActivity[];
  dispatchers: DispatcherReportRow[];
  carriers: CarrierReportRow[];
  teams: TeamReportRow[];
};

export type AppSettings = {
  dispatchFeeCalculation: {
    method: string;
    defaultPercentage: number;
    minimumFee: number;
    roundToNearestDollar: boolean;
  };
  allowedTruckTypes: TruckType[];
  allowedStatusReasons: StatusReason[];
  timezone: string;
  csvExport: {
    includeHeaders: boolean;
    dateFormat: string;
    maxRows: number;
    fileNamePrefix: string;
  };
};

export type FilterOption = {
  id: string;
  label: string;
};

export type DateRangeOption = {
  value: string;
  label: string;
};

export type RoleScope = {
  role: UserRole;
  user: User;
  teamName: string | null;
  dispatcherName: string | null;
  scopeLabel: string;
  isCompanyWide: boolean;
};
