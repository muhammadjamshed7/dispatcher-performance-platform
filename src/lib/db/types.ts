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
export type ActivityApprovalStatus =
  | "APPROVED"
  | "PENDING_TEAM_LEAD_APPROVAL"
  | "PENDING_ADMIN_APPROVAL"
  | "REJECTED";
export type ActivityApprovalType = "NEW_ACTIVITY" | "EDIT_ACTIVITY";
export type NotificationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "ADMIN_APPROVAL_REQUIRED"
  | "TEAM_LEAD_APPROVAL_REQUIRED"
  | "COMPLETED";
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
export type InvoiceType = "DISPATCHER_PAYABLE" | "CARRIER_RECEIVABLE";
export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type InvoicePaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHECK"
  | "OTHER";
export type AuditAction =
  | "USER_APPROVED"
  | "USER_MANUALLY_CREATED"
  | "USER_PASSWORD_RESET"
  | "USER_PASSWORD_CHANGED"
  | "USER_REJECTED"
  | "USER_ROLE_ASSIGNED"
  | "USER_TEAM_ASSIGNED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_LOGGED_IN"
  | "USER_LOGGED_OUT"
  | "USER_LOGIN_FAILED"
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_ACTIVATED"
  | "TEAM_DEACTIVATED"
  | "TEAM_LEAD_CREATED"
  | "TEAM_LEAD_ASSIGNED"
  | "DISPATCHER_CREATED"
  | "DISPATCHER_UPDATED"
  | "DISPATCHER_REACTIVATED"
  | "DISPATCHER_DEACTIVATED"
  | "CARRIER_CREATED"
  | "CARRIER_UPDATED"
  | "CARRIER_ACTIVATED"
  | "CARRIER_DEACTIVATED"
  | "CARRIER_REASSIGNED"
  | "CARRIER_EXPORTED"
  | "ACTIVITY_CREATED"
  | "ACTIVITY_UPDATED"
  | "ACTIVITY_SUBMITTED"
  | "ACTIVITY_EDIT_REQUEST_SUBMITTED"
  | "ACTIVITY_APPROVED_BY_TEAM_LEAD"
  | "ACTIVITY_APPROVED_BY_ADMIN"
  | "ACTIVITY_REJECTED"
  | "ACTIVITY_CHANGES_REQUESTED"
  | "ACTIVITY_PENDING_UPDATED"
  | "ACTIVITY_EXPORTED"
  | "SETTINGS_UPDATED"
  | "SETTINGS_DISPATCH_FEE_RULES_UPDATED"
  | "SETTINGS_TRUCK_TYPES_UPDATED"
  | "SETTINGS_STATUS_REASONS_UPDATED"
  | "SETTINGS_DIRECT_APPROVAL_UPDATED"
  | "NOTIFICATION_READ"
  | "NOTIFICATION_MARK_ALL_READ"
  | "REPORT_VIEWED"
  | "REPORT_EXPORTED"
  | "FINANCE_VIEWED"
  | "FINANCE_EXPORTED"
  | "AUDIT_LOGS_EXPORTED"
  | "INVOICE_GENERATED"
  | "INVOICE_UPDATED"
  | "INVOICE_PAYMENT_RECORDED"
  | "INVOICE_MARKED_PAID"
  | "INVOICE_CANCELLED"
  | "INVOICE_EXPORTED"
  | "INVOICE_VIEWED";

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
  notes: string | null;
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
  approvalStatus: ActivityApprovalStatus;
  submittedById: string | null;
  teamLeadApprovedById: string | null;
  adminApprovedById: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  approvalNotes: string | null;
  approvalType: ActivityApprovalType;
  submittedAt: string | null;
  teamLeadApprovedAt: string | null;
  adminApprovedAt: string | null;
  rejectedAt: string | null;
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
  directAdminApprovalMode: boolean;
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

export type ActivityEditRequest = {
  id: string;
  organizationId: string;
  originalActivityId: string;
  teamId: string;
  dispatcherId: string;
  approvalStatus: ActivityApprovalStatus;
  proposedChanges: Record<string, unknown>;
  previousData: Record<string, unknown>;
  submittedById: string;
  editedById: string;
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
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  organizationId: string;
  recipientUserId: string;
  title: string;
  message: string;
  notificationStatus: NotificationStatus;
  activityId: string | null;
  editRequestId: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
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

export type Invoice = {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  invoiceStatus: InvoiceStatus;
  paymentStatus: PaymentStatus;
  dispatcherId: string | null;
  carrierId: string | null;
  teamId: string | null;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotalAmount: string;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
  notes: string | null;
  createdById: string;
  updatedById: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  dailyActivityId: string | null;
  activityDate: string;
  carrierId: string;
  dispatcherId: string;
  teamId: string;
  status: LoadActivityStatus;
  origin: string | null;
  destination: string | null;
  totalMiles: string | null;
  loadAmount: string | null;
  dispatchFee: string | null;
  ratePerMile: string | null;
  itemDescription: string | null;
  amount: string;
  createdAt: string;
};

export type InvoicePayment = {
  id: string;
  invoiceId: string;
  organizationId: string;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  paymentReference: string | null;
  notes: string | null;
  recordedById: string;
  createdAt: string;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
