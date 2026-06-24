// Database row and enum types (Supabase / Postgres schema).
// Prisma schema remains for reference; runtime uses Supabase only.

export type UserRole = "ADMIN" | "TEAM_LEAD" | "DISPATCHER";
export type UserStatus = "ACTIVE" | "PENDING_APPROVAL" | "INACTIVE" | "INVITED";
export type TeamStatus = "ACTIVE" | "INACTIVE";
export type CarrierStatus = "ACTIVE" | "INACTIVE";
export type LoadActivityStatus =
  | "DELIVERED"
  | "CANCELLED"
  | "NOT_BOOKED"
  | "NOT_WORKING";
export type TruckType =
  | "DRY_VAN"
  | "REEFER"
  | "FLATBED"
  | "BOX_TRUCK"
  | "HOTSHOT"
  | "POWER_ONLY"
  | "CARGO_VAN";
export type RegistrationRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReportExportStatus = "PENDING" | "COMPLETED" | "FAILED";
export type AuditAction =
  | "USER_APPROVED"
  | "USER_REJECTED"
  | "USER_ROLE_ASSIGNED"
  | "USER_TEAM_ASSIGNED"
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_DEACTIVATED"
  | "DISPATCHER_CREATED"
  | "DISPATCHER_UPDATED"
  | "DISPATCHER_DEACTIVATED"
  | "CARRIER_CREATED"
  | "CARRIER_UPDATED"
  | "CARRIER_DEACTIVATED"
  | "CARRIER_REASSIGNED"
  | "ACTIVITY_CREATED"
  | "ACTIVITY_UPDATED"
  | "SETTINGS_UPDATED"
  | "REPORT_EXPORTED";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type User = {
  id: string;
  organizationId: string;
  supabaseUserId: string | null;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: UserRole;
  status: UserStatus;
  teamId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Team = {
  id: string;
  organizationId: string;
  name: string;
  teamLeadUserId: string | null;
  status: TeamStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Dispatcher = {
  id: string;
  organizationId: string;
  userId: string;
  teamId: string;
  status: TeamStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Carrier = {
  id: string;
  organizationId: string;
  carrierName: string;
  driverName: string;
  mcNumber: string;
  truckType: TruckType;
  teamId: string;
  dispatcherId: string | null;
  dispatchFeePercentage: string;
  status: CarrierStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DailyActivity = {
  id: string;
  organizationId: string;
  activityDate: string;
  carrierId: string;
  dispatcherId: string;
  teamId: string;
  status: LoadActivityStatus;
  carrierNameSnapshot: string;
  driverNameSnapshot: string;
  dispatcherNameSnapshot: string;
  teamNameSnapshot: string;
  truckTypeSnapshot: TruckType;
  dispatchFeePercentageSnapshot: string;
  origin: string | null;
  destination: string | null;
  totalMiles: string | null;
  loadAmount: string | null;
  ratePerMile: string | null;
  dispatchFee: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationRequest = {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  requestedRole: UserRole;
  preferredTeamId: string | null;
  preferredTeamName: string | null;
  notes: string | null;
  status: RegistrationRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  rejectionReason: string | null;
  assignedTeamId: string | null;
  assignedRole: UserRole | null;
};

export type OrganizationSettings = {
  id: string;
  organizationId: string;
  dispatchFeeMethod: string;
  defaultDispatchFeePercent: string;
  minimumDispatchFee: string;
  roundToNearestDollar: boolean;
  allowedTruckTypes: TruckType[];
  timezone: string;
  csvIncludeHeaders: boolean;
  csvDateFormat: string;
  csvMaxRows: number;
  csvFileNamePrefix: string;
  createdAt: string;
  updatedAt: string;
};

export type StatusReason = {
  id: string;
  organizationId: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ReportExport = {
  id: string;
  organizationId: string;
  requestedById: string;
  reportType: string;
  period: string;
  filters: Record<string, unknown>;
  status: ReportExportStatus;
  fileName: string | null;
  rowCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
