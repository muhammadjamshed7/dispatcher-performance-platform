import type { ActivityApprovalStatus } from "@/lib/constants/activity-approval";
import type { ActivityApprovalType } from "@/lib/constants/activity-approval";
import type { NotificationStatus } from "@/lib/constants/notifications";
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

export type CreateDispatcherResult = {
  dispatcher: Dispatcher;
  temporaryPassword: string;
};

export type Carrier = {
  id: string;
  carrierName: string;
  driverName: string;
  mcNumber: string;
  truckType: TruckType;
  assignedTeamId: string;
  assignedTeamName: string;
  assignedDispatcherId: string | null;
  assignedDispatcherName: string;
  dispatchFeePercentage: number;
  status: TeamStatus;
  notes?: string;
  createdAt: string;
};

export type DailyActivity = {
  id: string;
  date: string;
  carrierId: string;
  carrierName: string;
  dispatcherId: string;
  dispatcherName: string;
  teamId: string;
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
  approvalStatus: ActivityApprovalStatus;
  submittedById: string | null;
  teamLeadApprovedById: string | null;
  adminApprovedById: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  teamLeadApprovedAt: string | null;
  adminApprovedAt: string | null;
  rejectedAt: string | null;
  approvalNotes: string | null;
  approvalType: ActivityApprovalType;
  hasPendingEdit: boolean;
  pendingEditApprovalStatus: ActivityApprovalStatus | null;
  approvedByName: string | null;
  approvedByRole: Role | null;
};

export type ActivityEditRequestDto = {
  id: string;
  originalActivityId: string;
  teamId: string;
  dispatcherId: string;
  approvalStatus: ActivityApprovalStatus;
  proposedChanges: Record<string, unknown>;
  previousData: Record<string, unknown>;
  submittedById: string;
  editedById: string;
  editedByName: string | null;
  teamLeadApprovedById: string | null;
  adminApprovedById: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  approvalNotes: string | null;
  submittedAt: string;
  editedAt: string;
  teamLeadApprovedAt: string | null;
  adminApprovedAt: string | null;
  rejectedAt: string | null;
  carrierName: string | null;
  activityDate: string | null;
  dispatcherName: string | null;
  teamName: string | null;
  approvedByName: string | null;
  approvedByRole: Role | null;
};

export type PendingApprovalItem = {
  kind: "new_activity" | "edit_request";
  id: string;
  approvalStatus: ActivityApprovalStatus;
  approvalType: ActivityApprovalType;
  activityDate: string;
  carrierName: string;
  dispatcherName: string;
  teamName: string;
  status: LoadActivityStatus;
  submittedAt: string | null;
  editedAt: string | null;
  submittedByName: string | null;
  editedByName: string | null;
  rejectionReason: string | null;
  activity?: DailyActivity;
  editRequest?: ActivityEditRequestDto;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  notificationStatus: NotificationStatus;
  activityId: string | null;
  editRequestId: string | null;
  readAt: string | null;
  createdAt: string;
  submittedByName: string | null;
  carrierName: string | null;
  activityDate: string | null;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorRole: UserRole | null;
  teamName: string | null;
  dispatcherName: string | null;
  approvalStatus: ActivityApprovalStatus | null;
  status: string;
  notes: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
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

export type AdminDashboardMonthlyGrowthPoint = {
  month: string;
  growth: number;
  revenue: number;
};

export type AdminDashboardStatusTrendPoint = {
  date: string;
  delivered: number;
  cancelled: number;
  booked: number;
  notBooked: number;
  bookedButCancelled: number;
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
  statusTrend: AdminDashboardStatusTrendPoint[];
  trendDates: string[];
  monthlyGrowthTrend: AdminDashboardMonthlyGrowthPoint[];
};

export type AdminDashboardBundle = {
  filters: {
    dateFrom: string;
    dateTo: string;
    teamIds: string[];
    dispatcherIds: string[];
    carrierIds: string[];
    truckTypes: string[];
    statuses: string[];
    statusKeys: string[];
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
    carriers: {
      id: string;
      name: string;
      teamId: string;
      dispatcherId: string | null;
    }[];
    truckTypes: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
  };
};

export type AdminDailyReportSummary = {
  totalActivities: number;
  deliveredLoads: number;
  cancelledLoads: number;
  notBooked: number;
  notWorking: number;
  totalRevenue: number;
  dispatchFees: number;
  activeDispatchers: number;
  activeCarriers: number;
};

export type AdminDailyReportBundle = {
  filters: {
    date: string;
    teamId: string | null;
    dispatcherId: string | null;
    status: string | null;
  };
  summary: AdminDailyReportSummary;
  teamComparison: { team: string; deliveredLoads: number }[];
  revenueByTeam: { team: string; revenue: number }[];
  statusBreakdown: {
    name: string;
    value: number;
    percent: string;
    color: string;
  }[];
  liveActivities: {
    id: string;
    time: string;
    dispatcher: string;
    team: string;
    carrier: string;
    status: string;
    loadAmount: number | null;
    origin: string | null;
    destination: string | null;
  }[];
  filterOptions: {
    teams: { id: string; name: string }[];
    dispatchers: { id: string; name: string; teamId: string }[];
    statuses: { value: string; label: string }[];
  };
};

export type DispatcherDashboardMetrics = {
  personalRevenue: number;
  deliveredLoads: number;
  avgRatePerMile: number;
  assignedCarriers: number;
};

export type DispatcherTodayCompletion = {
  assignedActive: number;
  loggedToday: number;
  pendingCount: number;
  completionPercent: number;
  isComplete: boolean;
  message: string;
};

export type DispatcherPendingCarrier = {
  id: string;
  carrierName: string;
  driverName: string;
  truckType: string;
  lastActivityStatus: string | null;
  lastActivityDate: string | null;
};

export type DispatcherCarrierPerformanceRow = {
  carrierId: string;
  carrierName: string;
  driverName: string;
  truckType: string;
  recentStatus: string;
  lastActivityDate: string | null;
  loadsMtd: number;
  revenueMtd: number;
  carrierStatus: string;
};

export type DispatcherRecentActivityRow = {
  id: string;
  date: string;
  carrierName: string;
  status: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  loadAmount: number | null;
  ratePerMile: number | null;
  reason: string | null;
};

export type DispatcherDashboardBundle = {
  dispatcherName: string;
  filters: {
    dateFrom: string;
    dateTo: string;
    carrierId: string | null;
    truckType: string | null;
    status: string | null;
  };
  metrics: DispatcherDashboardMetrics;
  todayCompletion: DispatcherTodayCompletion;
  pendingCarriers: DispatcherPendingCarrier[];
  revenueTrend: { date: string; revenue: number }[];
  statusBreakdown: {
    name: string;
    value: number;
    percent: string;
    color: string;
  }[];
  assignedCarrierPerformance: DispatcherCarrierPerformanceRow[];
  recentActivities: DispatcherRecentActivityRow[];
  filterOptions: {
    carriers: { id: string; name: string }[];
    truckTypes: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
  };
};

export type DispatcherRanking = {
  rank: number;
  id: string;
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

export type FinanceFilterOptions = {
  carriers: { id: string; name: string }[];
  statuses: { value: LoadActivityStatus; label: string }[];
};

export type FinanceAppliedFilters = {
  dateRange: string;
  dateFrom: string;
  dateTo: string;
  carrierId: string | null;
  status: LoadActivityStatus | null;
};

export type FinanceSummary = {
  totalRevenue: number;
  totalDispatchFee: number;
  deliveredLoads: number;
  cancelledLoads: number;
  notBookedCount: number;
  notWorkingCount: number;
  averageRatePerMile: number | null;
  bookingEfficiency: number;
  currentMonthRevenue: number;
  currentMonthDispatchFee: number;
  monthOverMonthRevenueChange: number | null;
  monthOverMonthDispatchFeeChange: number | null;
};

export type FinanceCarrierRow = {
  id: string;
  carrierName: string;
  driverName: string;
  truckType: TruckType;
  deliveredLoads: number;
  totalLoadAmount: number;
  dispatchFeeEarned: number;
  averageRatePerMile: number | null;
};

export type FinanceLoadRow = {
  id: string;
  date: string;
  carrierName: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  loadAmount: number | null;
  ratePerMile: number | null;
  dispatchFee: number | null;
  status: LoadActivityStatus;
};

export type FinanceMonthlyEarnings = {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  dispatchFee: number;
};

export type FinanceAssignedCarrier = {
  id: string;
  carrierName: string;
  driverName: string;
  truckType: TruckType;
};

export type DispatcherFinanceProfile = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  teamName: string;
  role: string;
  status: TeamStatus;
  assignedCarriersCount: number;
  assignedCarriers: FinanceAssignedCarrier[];
};

export type FinancePaymentTracking = {
  paidAmount: number | null;
  pendingAmount: number | null;
  message: string;
};

export type DispatcherFinanceBundle = {
  profile: DispatcherFinanceProfile;
  filters: FinanceAppliedFilters;
  filterOptions: FinanceFilterOptions;
  summary: FinanceSummary;
  monthlyEarnings: FinanceMonthlyEarnings[];
  carrierBreakdown: FinanceCarrierRow[];
  loadHistory: FinanceLoadRow[];
  paymentTracking: FinancePaymentTracking;
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
  currency: string;
  csvExport: {
    includeHeaders: boolean;
    dateFormat: string;
    maxRows: number;
    fileNamePrefix: string;
  };
  directAdminApprovalMode: boolean;
};

export type DispatchFeeRules = {
  method: "percentage";
  defaultPercentage: number;
  minimumFee: number;
  roundToNearestDollar: boolean;
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

export type SearchResultGroup = {
  id: string;
  label: string;
  href: string;
};

export type SearchResults = {
  carriers: SearchResultGroup[];
  dispatchers: SearchResultGroup[];
  activities: SearchResultGroup[];
};
