import "server-only";

import { z } from "zod";
import { format as formatDate } from "date-fns";

import {
  INVOICE_CANCELLED,
  INVOICE_CARRIER_RECEIVABLE,
  INVOICE_DRAFT,
  INVOICE_DISPATCHER_PAYABLE,
  INVOICE_ISSUED,
  INVOICE_OVERDUE,
  INVOICE_PAID,
  INVOICE_PARTIALLY_PAID,
  INVOICE_PAYMENT_METHODS,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  PAYMENT_PAID,
  PAYMENT_PARTIALLY_PAID,
  PAYMENT_STATUSES,
  PAYMENT_UNPAID,
  type InvoicePaymentMethod,
  type InvoiceStatus,
  type InvoiceType,
  type PaymentStatus,
} from "@/lib/constants/invoices";
import { APPROVED } from "@/lib/constants/activity-approval";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import type {
  Carrier,
  DailyActivity,
  Dispatcher,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  Team,
  User,
} from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import {
  assertDb,
  assertDbVoid,
  createId,
  nowIso,
  toAmount,
} from "@/lib/db/utils";
import { buildCsv } from "@/lib/utils/csv";
import { computeAverageRatePerMile } from "@/lib/utils/compute-finance-metrics";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { writeAuditLog } from "@/server/services/audit.service";
import { createNotification } from "@/server/services/notifications.service";
import type {
  InvoiceDashboardBundle,
  InvoiceDetail,
  InvoiceDetailItem,
  InvoiceFilterOptions,
  InvoiceListBundle,
  InvoiceListItem,
  InvoicePaymentEntry,
  InvoicePreview,
  InvoiceSummaryMetrics,
} from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const invoiceFiltersSchema = z.object({
  invoiceType: z.enum(INVOICE_TYPES).optional(),
  invoiceStatus: z.enum(INVOICE_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  teamId: z.string().optional(),
  dateRange: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  dueDate: z.string().optional(),
  q: z.string().optional(),
  paid: z.string().optional(),
  overdue: z.string().optional(),
});

export const generateInvoiceSchema = z.object({
  invoiceType: z.enum(INVOICE_TYPES),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  periodStart: z.string().regex(DATE_RE),
  periodEnd: z.string().regex(DATE_RE),
  issueDate: z.string().regex(DATE_RE),
  dueDate: z.string().regex(DATE_RE),
  notes: z.string().max(2000).optional(),
  previewOnly: z.boolean().optional(),
});

export const updateInvoiceSchema = z.object({
  issueDate: z.string().regex(DATE_RE).optional(),
  dueDate: z.string().regex(DATE_RE).optional(),
  notes: z.string().max(2000).nullable().optional(),
  invoiceStatus: z.enum([INVOICE_DRAFT, INVOICE_ISSUED]).optional(),
});

export const recordPaymentSchema = z.object({
  paymentAmount: z.coerce.number().positive(),
  paymentDate: z.string().regex(DATE_RE),
  paymentMethod: z.enum(INVOICE_PAYMENT_METHODS),
  paymentReference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export const exportInvoiceSchema = z.object({
  format: z.enum(["pdf", "csv", "payments-csv"]).default("pdf"),
});

type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

type LookupMaps = {
  teams: Map<string, Team>;
  dispatchers: Map<string, Dispatcher>;
  dispatcherUsers: Map<string, User>;
  carriers: Map<string, Carrier>;
  users: Map<string, User>;
  activities: Map<string, DailyActivity>;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertDateRange(start: string, end: string): void {
  if (start > end) {
    throw new ValidationError("Invoice period start cannot be after end.");
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function effectiveInvoiceStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.invoiceStatus === INVOICE_CANCELLED) {
    return INVOICE_CANCELLED;
  }

  if (invoice.paymentStatus === PAYMENT_PAID) {
    return INVOICE_PAID;
  }

  if (invoice.dueDate < todayKey() && toAmount(invoice.pendingAmount) > 0) {
    return INVOICE_OVERDUE;
  }

  if (invoice.paymentStatus === PAYMENT_PARTIALLY_PAID) {
    return INVOICE_PARTIALLY_PAID;
  }

  return invoice.invoiceStatus;
}

function paymentStatusForAmounts(
  paidAmount: number,
  totalAmount: number,
): PaymentStatus {
  if (paidAmount <= 0) {
    return PAYMENT_UNPAID;
  }

  if (paidAmount < totalAmount) {
    return PAYMENT_PARTIALLY_PAID;
  }

  return PAYMENT_PAID;
}

function invoiceStatusForAmounts(
  paidAmount: number,
  totalAmount: number,
  dueDate: string,
): InvoiceStatus {
  const paymentStatus = paymentStatusForAmounts(paidAmount, totalAmount);
  const pendingAmount = roundCurrency(Math.max(totalAmount - paidAmount, 0));

  if (paymentStatus === PAYMENT_PAID) {
    return INVOICE_PAID;
  }

  if (dueDate < todayKey() && pendingAmount > 0) {
    return INVOICE_OVERDUE;
  }

  if (paymentStatus === PAYMENT_PARTIALLY_PAID) {
    return INVOICE_PARTIALLY_PAID;
  }

  return INVOICE_ISSUED;
}

function assertInvoiceScope(scope: AccessScope, invoice: Invoice): void {
  if (scope.organizationId !== invoice.organizationId) {
    throw new NotFoundError("Invoice not found.");
  }

  if (scope.role === ADMIN) {
    return;
  }

  if (scope.role === TEAM_LEAD) {
    if (scope.teamId && invoice.teamId === scope.teamId) {
      return;
    }
    throw new ForbiddenError("You do not have access to this invoice.");
  }

  if (
    scope.role === DISPATCHER &&
    scope.dispatcherId &&
    invoice.dispatcherId === scope.dispatcherId
  ) {
    return;
  }

  throw new ForbiddenError("You do not have access to this invoice.");
}

function requireManageAccess(scope: AccessScope): void {
  if (scope.role !== ADMIN) {
    throw new ForbiddenError("Admin access is required to manage invoices.");
  }
}

function activityAmount(
  activity: Pick<DailyActivity, "status" | "dispatchFee">,
): number {
  return activity.status === DELIVERED ? toAmount(activity.dispatchFee) : 0;
}

function computeSummaryFromItems(
  items: Array<{
    status: string;
    totalMiles: string | number | null;
    loadAmount: string | number | null;
    dispatchFee: string | number | null;
    amount: string | number | null;
  }>,
  paidAmount: number,
): InvoiceSummaryMetrics {
  const delivered = items.filter((item) => item.status === DELIVERED);
  const totalAmount = roundCurrency(
    items.reduce((sum, item) => sum + toAmount(String(item.amount ?? 0)), 0),
  );
  const totalRevenue = roundCurrency(
    delivered.reduce(
      (sum, item) => sum + toAmount(String(item.loadAmount ?? 0)),
      0,
    ),
  );
  const totalDispatchFee = roundCurrency(
    delivered.reduce(
      (sum, item) => sum + toAmount(String(item.dispatchFee ?? 0)),
      0,
    ),
  );
  const totalMiles = roundCurrency(
    items.reduce(
      (sum, item) => sum + toAmount(String(item.totalMiles ?? 0)),
      0,
    ),
  );

  return {
    totalDeliveredLoads: delivered.length,
    totalCancelledLoads: items.filter((item) => item.status === CANCELLED)
      .length,
    totalNotBooked: items.filter((item) => item.status === NOT_BOOKED).length,
    totalNotWorking: items.filter((item) => item.status === NOT_WORKING)
      .length,
    totalRevenue,
    totalDispatchFee,
    totalMiles,
    averageRatePerMile: computeAverageRatePerMile(
      items.map((item) => ({
        status: item.status as DailyActivity["status"],
        loadAmount: toAmount(String(item.loadAmount ?? 0)),
        totalMiles: toAmount(String(item.totalMiles ?? 0)),
      })),
    ),
    payableReceivableAmount: totalAmount,
    paidAmount,
    pendingAmount: roundCurrency(Math.max(totalAmount - paidAmount, 0)),
  };
}

async function fetchLookupMaps(input: {
  organizationId: string;
  invoices?: Invoice[];
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}): Promise<LookupMaps> {
  const teamIds = new Set<string>();
  const dispatcherIds = new Set<string>();
  const carrierIds = new Set<string>();
  const userIds = new Set<string>();
  const activityIds = new Set<string>();

  for (const invoice of input.invoices ?? []) {
    if (invoice.teamId) teamIds.add(invoice.teamId);
    if (invoice.dispatcherId) dispatcherIds.add(invoice.dispatcherId);
    if (invoice.carrierId) carrierIds.add(invoice.carrierId);
    userIds.add(invoice.createdById);
    if (invoice.updatedById) userIds.add(invoice.updatedById);
  }

  for (const item of input.items ?? []) {
    teamIds.add(item.teamId);
    dispatcherIds.add(item.dispatcherId);
    carrierIds.add(item.carrierId);
    if (item.dailyActivityId) activityIds.add(item.dailyActivityId);
  }

  for (const payment of input.payments ?? []) {
    userIds.add(payment.recordedById);
  }

  const [teams, dispatchers, carriers, activities] = await Promise.all([
    teamIds.size
      ? db()
          .from(T.Team)
          .select("*")
          .eq("organizationId", input.organizationId)
          .in("id", [...teamIds])
      : Promise.resolve({ data: [], error: null }),
    dispatcherIds.size
      ? db()
          .from(T.Dispatcher)
          .select("*")
          .eq("organizationId", input.organizationId)
          .in("id", [...dispatcherIds])
      : Promise.resolve({ data: [], error: null }),
    carrierIds.size
      ? db()
          .from(T.Carrier)
          .select("*")
          .eq("organizationId", input.organizationId)
          .in("id", [...carrierIds])
      : Promise.resolve({ data: [], error: null }),
    activityIds.size
      ? db()
          .from(T.DailyActivity)
          .select("*")
          .eq("organizationId", input.organizationId)
          .in("id", [...activityIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const dispatcherRows = (assertDb(dispatchers) ?? []) as Dispatcher[];
  dispatcherRows.forEach((dispatcher) => userIds.add(dispatcher.userId));

  const userRows = userIds.size
    ? ((assertDb(
        await db()
          .from(T.User)
          .select("*")
          .eq("organizationId", input.organizationId)
          .in("id", [...userIds]),
      ) ?? []) as User[])
    : [];

  return {
    teams: new Map(((assertDb(teams) ?? []) as Team[]).map((row) => [row.id, row])),
    dispatchers: new Map(dispatcherRows.map((row) => [row.id, row])),
    dispatcherUsers: new Map(
      dispatcherRows.map((dispatcher) => [
        dispatcher.id,
        userRows.find((user) => user.id === dispatcher.userId)!,
      ]),
    ),
    carriers: new Map(
      ((assertDb(carriers) ?? []) as Carrier[]).map((row) => [row.id, row]),
    ),
    users: new Map(userRows.map((row) => [row.id, row])),
    activities: new Map(
      ((assertDb(activities) ?? []) as DailyActivity[]).map((row) => [
        row.id,
        row,
      ]),
    ),
  };
}

function mapInvoiceListItem(
  invoice: Invoice,
  items: InvoiceItem[],
  lookups: LookupMaps,
): InvoiceListItem {
  const dispatcherUser = invoice.dispatcherId
    ? lookups.dispatcherUsers.get(invoice.dispatcherId)
    : null;
  const carrier = invoice.carrierId
    ? lookups.carriers.get(invoice.carrierId)
    : null;
  const team = invoice.teamId ? lookups.teams.get(invoice.teamId) : null;
  const summary = computeSummaryFromItems(items, toAmount(invoice.paidAmount));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    invoiceStatus: effectiveInvoiceStatus(invoice),
    paymentStatus: invoice.paymentStatus,
    entityName:
      invoice.invoiceType === INVOICE_DISPATCHER_PAYABLE
        ? (dispatcherUser?.fullName ?? "Unknown dispatcher")
        : (carrier?.carrierName ?? "Unknown carrier"),
    entityEmail: dispatcherUser?.email ?? null,
    teamName: team?.name ?? null,
    dispatcherName: dispatcherUser?.fullName ?? null,
    carrierName: carrier?.carrierName ?? null,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: toAmount(invoice.totalAmount),
    paidAmount: toAmount(invoice.paidAmount),
    pendingAmount: toAmount(invoice.pendingAmount),
    createdAt: invoice.createdAt,
    summary,
  };
}

function mapInvoiceDetailItem(
  item: InvoiceItem,
  lookups: LookupMaps,
): InvoiceDetailItem {
  const activity = item.dailyActivityId
    ? lookups.activities.get(item.dailyActivityId)
    : null;
  const carrier = lookups.carriers.get(item.carrierId);
  const dispatcherUser = lookups.dispatcherUsers.get(item.dispatcherId);
  const team = lookups.teams.get(item.teamId);

  return {
    id: item.id,
    dailyActivityId: item.dailyActivityId,
    activityDate: item.activityDate,
    carrierId: item.carrierId,
    carrierName: activity?.carrierNameSnapshot ?? carrier?.carrierName ?? "",
    dispatcherId: item.dispatcherId,
    dispatcherName:
      activity?.dispatcherNameSnapshot ?? dispatcherUser?.fullName ?? "",
    teamId: item.teamId,
    teamName: activity?.teamNameSnapshot ?? team?.name ?? "",
    status: item.status,
    origin: item.origin,
    destination: item.destination,
    totalMiles: item.totalMiles ? toAmount(item.totalMiles) : null,
    loadAmount: item.loadAmount ? toAmount(item.loadAmount) : null,
    dispatchFee: item.dispatchFee ? toAmount(item.dispatchFee) : null,
    ratePerMile: item.ratePerMile ? toAmount(item.ratePerMile) : null,
    itemDescription: item.itemDescription,
    amount: toAmount(item.amount),
  };
}

function mapPayment(
  payment: InvoicePayment,
  lookups: LookupMaps,
): InvoicePaymentEntry {
  return {
    id: payment.id,
    paymentAmount: toAmount(payment.paymentAmount),
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference,
    notes: payment.notes,
    recordedByName: lookups.users.get(payment.recordedById)?.fullName ?? null,
    createdAt: payment.createdAt,
  };
}

async function loadInvoiceRows(
  scope: AccessScope,
  filters: InvoiceFilters = {},
): Promise<{ invoices: Invoice[]; items: InvoiceItem[]; lookups: LookupMaps }> {
  let query = db()
    .from(T.Invoice)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .order("issueDate", { ascending: false })
    .order("createdAt", { ascending: false });

  if (scope.role === TEAM_LEAD) {
    query = scope.teamId ? query.eq("teamId", scope.teamId) : query.eq("teamId", "__none__");
  } else if (scope.role === DISPATCHER) {
    query = scope.dispatcherId
      ? query.eq("dispatcherId", scope.dispatcherId)
      : query.eq("dispatcherId", "__none__");
  }

  if (filters.invoiceType) query = query.eq("invoiceType", filters.invoiceType);
  if (filters.paymentStatus) query = query.eq("paymentStatus", filters.paymentStatus);
  if (filters.dispatcherId) query = query.eq("dispatcherId", filters.dispatcherId);
  if (filters.carrierId) query = query.eq("carrierId", filters.carrierId);
  if (filters.teamId) query = query.eq("teamId", filters.teamId);
  if (filters.dateFrom) query = query.gte("issueDate", filters.dateFrom);
  if (filters.dateTo) query = query.lte("issueDate", filters.dateTo);
  if (filters.dueDate) query = query.eq("dueDate", filters.dueDate);
  if (filters.paid === "paid") query = query.eq("paymentStatus", PAYMENT_PAID);
  if (filters.paid === "unpaid") query = query.neq("paymentStatus", PAYMENT_PAID);

  const invoices = (assertDb(await query) ?? []) as Invoice[];
  const ids = invoices.map((invoice) => invoice.id);
  const items =
    ids.length > 0
      ? ((assertDb(
          await db()
            .from(T.InvoiceItem)
            .select("*")
            .in("invoiceId", ids)
            .order("activityDate", { ascending: true }),
        ) ?? []) as InvoiceItem[])
      : [];
  const lookups = await fetchLookupMaps({
    organizationId: scope.organizationId,
    invoices,
    items,
  });

  return { invoices, items, lookups };
}

async function getFilterOptions(scope: AccessScope): Promise<InvoiceFilterOptions> {
  let teamQuery = db()
    .from(T.Team)
    .select("id, name")
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .order("name", { ascending: true });
  let dispatcherQuery = db()
    .from(T.Dispatcher)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null);
  let carrierQuery = db()
    .from(T.Carrier)
    .select("id, carrierName, teamId, dispatcherId")
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .order("carrierName", { ascending: true });

  if (scope.role === TEAM_LEAD && scope.teamId) {
    teamQuery = teamQuery.eq("id", scope.teamId);
    dispatcherQuery = dispatcherQuery.eq("teamId", scope.teamId);
    carrierQuery = carrierQuery.eq("teamId", scope.teamId);
  } else if (scope.role === DISPATCHER && scope.dispatcherId) {
    dispatcherQuery = dispatcherQuery.eq("id", scope.dispatcherId);
    carrierQuery = carrierQuery.eq("dispatcherId", scope.dispatcherId);
  }

  const [teamsResult, dispatchersResult, carriersResult] = await Promise.all([
    teamQuery,
    dispatcherQuery,
    carrierQuery,
  ]);
  const teams = (assertDb(teamsResult) ?? []) as Pick<Team, "id" | "name">[];
  const dispatchers = (assertDb(dispatchersResult) ?? []) as Dispatcher[];
  const users =
    dispatchers.length > 0
      ? ((assertDb(
          await db()
            .from(T.User)
            .select("id, fullName")
            .eq("organizationId", scope.organizationId)
            .in(
              "id",
              dispatchers.map((dispatcher) => dispatcher.userId),
            ),
        ) ?? []) as Pick<User, "id" | "fullName">[])
      : [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  return {
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
    dispatchers: dispatchers.map((dispatcher) => ({
      id: dispatcher.id,
      name: usersById.get(dispatcher.userId)?.fullName ?? "Unknown dispatcher",
      teamId: dispatcher.teamId,
    })),
    carriers: ((assertDb(carriersResult) ?? []) as Array<{
      id: string;
      carrierName: string;
      teamId: string;
      dispatcherId: string | null;
    }>).map((carrier) => ({
      id: carrier.id,
      name: carrier.carrierName,
      teamId: carrier.teamId,
      dispatcherId: carrier.dispatcherId,
    })),
  };
}

function buildDashboard(invoices: InvoiceListItem[]): InvoiceDashboardBundle {
  const active = invoices.filter(
    (invoice) => invoice.invoiceStatus !== INVOICE_CANCELLED,
  );
  const sum = (rows: InvoiceListItem[], key: keyof InvoiceListItem) =>
    roundCurrency(
      rows.reduce((total, row) => total + Number(row[key] ?? 0), 0),
    );
  const paid = active.filter((invoice) => invoice.paymentStatus === PAYMENT_PAID);
  const unpaid = active.filter((invoice) => invoice.paymentStatus === PAYMENT_UNPAID);
  const partial = active.filter(
    (invoice) => invoice.paymentStatus === PAYMENT_PARTIALLY_PAID,
  );
  const overdue = active.filter(
    (invoice) => invoice.invoiceStatus === INVOICE_OVERDUE,
  );
  const dispatcherRows = active.filter(
    (invoice) => invoice.invoiceType === INVOICE_DISPATCHER_PAYABLE,
  );
  const carrierRows = active.filter(
    (invoice) => invoice.invoiceType === INVOICE_CARRIER_RECEIVABLE,
  );

  const monthMap = new Map<
    string,
    { month: string; totalAmount: number; paidAmount: number; pendingAmount: number }
  >();
  for (const invoice of active) {
    const month = invoice.issueDate.slice(0, 7);
    const existing = monthMap.get(month) ?? {
      month,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };
    existing.totalAmount += invoice.totalAmount;
    existing.paidAmount += invoice.paidAmount;
    existing.pendingAmount += invoice.pendingAmount;
    monthMap.set(month, existing);
  }

  return {
    metrics: {
      totalInvoices: active.length,
      totalInvoiceAmount: sum(active, "totalAmount"),
      paidInvoices: paid.length,
      paidAmount: sum(active, "paidAmount"),
      unpaidInvoices: unpaid.length,
      unpaidAmount: sum(unpaid, "pendingAmount"),
      partiallyPaidInvoices: partial.length,
      partiallyPaidAmount: sum(partial, "pendingAmount"),
      overdueInvoices: overdue.length,
      overdueAmount: sum(overdue, "pendingAmount"),
      dispatcherInvoiceCount: dispatcherRows.length,
      dispatcherPaidCount: dispatcherRows.filter(
        (invoice) => invoice.paymentStatus === PAYMENT_PAID,
      ).length,
      dispatcherUnpaidCount: dispatcherRows.filter(
        (invoice) => invoice.paymentStatus !== PAYMENT_PAID,
      ).length,
      dispatcherPaidAmount: sum(dispatcherRows, "paidAmount"),
      dispatcherPendingAmount: sum(dispatcherRows, "pendingAmount"),
      carrierInvoiceCount: carrierRows.length,
      carrierPaidCount: carrierRows.filter(
        (invoice) => invoice.paymentStatus === PAYMENT_PAID,
      ).length,
      carrierUnpaidCount: carrierRows.filter(
        (invoice) => invoice.paymentStatus !== PAYMENT_PAID,
      ).length,
      carrierPaidAmount: sum(carrierRows, "paidAmount"),
      carrierPendingAmount: sum(carrierRows, "pendingAmount"),
    },
    paidVsPending: [
      {
        label: "Invoices",
        paid: paid.length,
        pending: active.length - paid.length,
      },
    ],
    typePaidVsPending: [
      {
        label: "Dispatcher",
        paid: dispatcherRows.filter(
          (invoice) => invoice.paymentStatus === PAYMENT_PAID,
        ).length,
        pending: dispatcherRows.filter(
          (invoice) => invoice.paymentStatus !== PAYMENT_PAID,
        ).length,
      },
      {
        label: "Carrier",
        paid: carrierRows.filter(
          (invoice) => invoice.paymentStatus === PAYMENT_PAID,
        ).length,
        pending: carrierRows.filter(
          (invoice) => invoice.paymentStatus !== PAYMENT_PAID,
        ).length,
      },
    ],
    monthlyTrend: [...monthMap.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((row) => ({
        month: row.month,
        totalAmount: roundCurrency(row.totalAmount),
        paidAmount: roundCurrency(row.paidAmount),
        pendingAmount: roundCurrency(row.pendingAmount),
      })),
  };
}

export async function listInvoices(
  scope: AccessScope,
  actor: AuthContextUser,
  rawFilters: InvoiceFilters = {},
): Promise<InvoiceListBundle> {
  const filters = invoiceFiltersSchema.parse(rawFilters);
  const { invoices, items, lookups } = await loadInvoiceRows(scope, filters);
  const itemsByInvoice = new Map<string, InvoiceItem[]>();
  for (const item of items) {
    const bucket = itemsByInvoice.get(item.invoiceId) ?? [];
    bucket.push(item);
    itemsByInvoice.set(item.invoiceId, bucket);
  }

  let mapped = invoices.map((invoice) =>
    mapInvoiceListItem(invoice, itemsByInvoice.get(invoice.id) ?? [], lookups),
  );

  if (filters.overdue === "true") {
    mapped = mapped.filter((invoice) => invoice.invoiceStatus === INVOICE_OVERDUE);
  }

  if (filters.invoiceStatus) {
    mapped = mapped.filter(
      (invoice) => invoice.invoiceStatus === filters.invoiceStatus,
    );
  }

  if (filters.q?.trim()) {
    const term = filters.q.trim().toLowerCase();
    mapped = mapped.filter((invoice) =>
      [
        invoice.invoiceNumber,
        invoice.entityName,
        invoice.teamName,
        invoice.dispatcherName,
        invoice.carrierName,
      ].some((value) => value?.toLowerCase().includes(term)),
    );
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_VIEWED",
    entityType: "Invoice",
    entityId: null,
    metadata: {
      entityName: "Invoices",
      filters,
      rowCount: mapped.length,
    },
  });

  return {
    invoices: mapped,
    dashboard: buildDashboard(mapped),
    filterOptions: await getFilterOptions(scope),
  };
}

async function loadApprovedActivitiesForInvoice(
  scope: AccessScope,
  input: GenerateInvoiceInput,
): Promise<DailyActivity[]> {
  assertDateRange(input.periodStart, input.periodEnd);

  let query = db()
    .from(T.DailyActivity)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .eq("approvalStatus", APPROVED)
    .gte("activityDate", input.periodStart)
    .lte("activityDate", input.periodEnd)
    .order("activityDate", { ascending: true });

  if (input.invoiceType === INVOICE_DISPATCHER_PAYABLE) {
    if (!input.dispatcherId) {
      throw new ValidationError("Dispatcher is required.");
    }
    query = query.eq("dispatcherId", input.dispatcherId);
  } else {
    if (!input.carrierId) {
      throw new ValidationError("Carrier is required.");
    }
    query = query.eq("carrierId", input.carrierId);
  }

  return (assertDb(await query) ?? []) as DailyActivity[];
}

async function assertNoDuplicateInvoice(
  scope: AccessScope,
  input: GenerateInvoiceInput,
): Promise<void> {
  let query = db()
    .from(T.Invoice)
    .select("id", { count: "exact", head: true })
    .eq("organizationId", scope.organizationId)
    .eq("invoiceType", input.invoiceType)
    .eq("periodStart", input.periodStart)
    .eq("periodEnd", input.periodEnd)
    .neq("invoiceStatus", INVOICE_CANCELLED)
    .is("deletedAt", null);

  if (input.invoiceType === INVOICE_DISPATCHER_PAYABLE) {
    query = query.eq("dispatcherId", input.dispatcherId!);
  } else {
    query = query.eq("carrierId", input.carrierId!);
  }

  const result = await query;
  if (result.error) {
    throw new Error(result.error.message);
  }
  if ((result.count ?? 0) > 0) {
    throw new ValidationError(
      "An active invoice already exists for this entity and period.",
    );
  }
}

function previewFromActivities(
  invoiceType: InvoiceType,
  activities: DailyActivity[],
): InvoicePreview {
  const items = activities.map((activity) => ({
    id: activity.id,
    dailyActivityId: activity.id,
    activityDate: activity.activityDate,
    carrierId: activity.carrierId,
    carrierName: activity.carrierNameSnapshot,
    dispatcherId: activity.dispatcherId,
    dispatcherName: activity.dispatcherNameSnapshot,
    teamId: activity.teamId,
    teamName: activity.teamNameSnapshot,
    status: activity.status,
    origin: activity.origin,
    destination: activity.destination,
    totalMiles: activity.totalMiles ? toAmount(activity.totalMiles) : null,
    loadAmount: activity.loadAmount ? toAmount(activity.loadAmount) : null,
    dispatchFee: activity.dispatchFee ? toAmount(activity.dispatchFee) : null,
    ratePerMile: activity.ratePerMile ? toAmount(activity.ratePerMile) : null,
    itemDescription: activity.reason ?? activity.notes ?? null,
    amount: activityAmount(activity),
  }));
  const delivered = activities.filter((activity) => activity.status === DELIVERED);

  return {
    activityCount: activities.length,
    deliveredLoads: delivered.length,
    cancelledLoads: activities.filter((activity) => activity.status === CANCELLED)
      .length,
    notBooked: activities.filter((activity) => activity.status === NOT_BOOKED)
      .length,
    notWorking: activities.filter((activity) => activity.status === NOT_WORKING)
      .length,
    totalLoadAmount: roundCurrency(
      delivered.reduce((sum, activity) => sum + toAmount(activity.loadAmount), 0),
    ),
    totalDispatchFee: roundCurrency(
      delivered.reduce(
        (sum, activity) => sum + toAmount(activity.dispatchFee),
        0,
      ),
    ),
    expectedInvoiceAmount: roundCurrency(
      items.reduce((sum, item) => sum + item.amount, 0),
    ),
    activities: items,
  };
}

async function generateInvoiceNumber(
  organizationId: string,
  invoiceType: InvoiceType,
  issueDate: string,
): Promise<string> {
  const year = issueDate.slice(0, 4);
  const prefix =
    invoiceType === INVOICE_DISPATCHER_PAYABLE ? "DISP-INV" : "CARR-INV";
  const likePrefix = `${prefix}-${year}-%`;
  const result = await db()
    .from(T.Invoice)
    .select("id", { count: "exact", head: true })
    .eq("organizationId", organizationId)
    .like("invoiceNumber", likePrefix);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return `${prefix}-${year}-${String((result.count ?? 0) + 1).padStart(4, "0")}`;
}

async function notifyDispatcherInvoice(input: {
  organizationId: string;
  dispatcherId: string | null;
  title: string;
  message: string;
  invoiceId: string;
  invoiceNumber: string;
  teamId: string | null;
}): Promise<void> {
  if (!input.dispatcherId) return;

  const dispatcher = assertDb(
    await db()
      .from(T.Dispatcher)
      .select("userId")
      .eq("id", input.dispatcherId)
      .eq("organizationId", input.organizationId)
      .maybeSingle(),
  ) as Pick<Dispatcher, "userId"> | null;

  if (!dispatcher?.userId) return;

  await createNotification({
    organizationId: input.organizationId,
    recipientUserId: dispatcher.userId,
    title: input.title,
    message: input.message,
    notificationStatus: "COMPLETED",
    metadata: {
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      teamId: input.teamId,
    },
  });
}

export async function generateInvoice(
  scope: AccessScope,
  actor: AuthContextUser,
  rawInput: GenerateInvoiceInput,
): Promise<InvoiceDetail | InvoicePreview> {
  requireManageAccess(scope);
  const input = generateInvoiceSchema.parse(rawInput);
  const activities = await loadApprovedActivitiesForInvoice(scope, input);
  const preview = previewFromActivities(input.invoiceType, activities);

  if (input.previewOnly) {
    return preview;
  }

  if (activities.length === 0) {
    throw new ValidationError(
      "No approved activities were found for this entity and period.",
    );
  }

  await assertNoDuplicateInvoice(scope, input);

  const teamIds = [...new Set(activities.map((activity) => activity.teamId))];
  const primaryTeamId = teamIds.length === 1 ? teamIds[0]! : activities[0]!.teamId;
  const totalAmount = preview.expectedInvoiceAmount;
  const invoiceId = createId();
  const invoiceNumber = await generateInvoiceNumber(
    scope.organizationId,
    input.invoiceType,
    input.issueDate,
  );
  const now = nowIso();

  assertDbVoid(
    await db().from(T.Invoice).insert({
      id: invoiceId,
      organizationId: scope.organizationId,
      invoiceNumber,
      invoiceType: input.invoiceType,
      invoiceStatus: invoiceStatusForAmounts(0, totalAmount, input.dueDate),
      paymentStatus: PAYMENT_UNPAID,
      dispatcherId:
        input.invoiceType === INVOICE_DISPATCHER_PAYABLE
          ? input.dispatcherId
          : activities[0]?.dispatcherId ?? null,
      carrierId:
        input.invoiceType === INVOICE_CARRIER_RECEIVABLE
          ? input.carrierId
          : null,
      teamId: primaryTeamId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      subtotalAmount: totalAmount,
      totalAmount,
      paidAmount: 0,
      pendingAmount: totalAmount,
      notes: input.notes ?? null,
      createdById: actor.id,
      updatedById: actor.id,
      createdAt: now,
      updatedAt: now,
    }),
  );

  assertDbVoid(
    await db().from(T.InvoiceItem).insert(
      activities.map((activity) => ({
        id: createId(),
        invoiceId,
        dailyActivityId: activity.id,
        activityDate: activity.activityDate,
        carrierId: activity.carrierId,
        dispatcherId: activity.dispatcherId,
        teamId: activity.teamId,
        status: activity.status,
        origin: activity.origin,
        destination: activity.destination,
        totalMiles: activity.totalMiles,
        loadAmount: activity.status === DELIVERED ? activity.loadAmount : null,
        dispatchFee: activity.status === DELIVERED ? activity.dispatchFee : null,
        ratePerMile: activity.status === DELIVERED ? activity.ratePerMile : null,
        itemDescription: activity.reason ?? activity.notes ?? null,
        amount: activityAmount(activity),
        createdAt: now,
      })),
    ),
  );

  const detail = await getInvoiceDetail(scope, actor, invoiceId, {
    audit: false,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_GENERATED",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: {
      entityName: invoiceNumber,
      invoiceType: input.invoiceType,
      entityDisplayName: detail.entityName,
      filters: input,
      rowCount: activities.length,
      totalAmount,
      updatedStatus: detail.invoiceStatus,
    },
  });

  await notifyDispatcherInvoice({
    organizationId: scope.organizationId,
    dispatcherId: detail.invoiceType === INVOICE_DISPATCHER_PAYABLE ? detail.items[0]?.dispatcherId ?? null : null,
    title: "Invoice generated",
    message: `${detail.invoiceNumber} has been generated for ${formatDate(new Date(`${detail.periodStart}T12:00:00Z`), "MMM d")} to ${formatDate(new Date(`${detail.periodEnd}T12:00:00Z`), "MMM d, yyyy")}.`,
    invoiceId,
    invoiceNumber,
    teamId: detail.items[0]?.teamId ?? null,
  });

  return detail;
}

export async function getInvoiceDetail(
  scope: AccessScope,
  actor: AuthContextUser,
  invoiceId: string,
  options: { audit?: boolean } = {},
): Promise<InvoiceDetail> {
  const invoice = assertDb(
    await db()
      .from(T.Invoice)
      .select("*")
      .eq("id", invoiceId)
      .eq("organizationId", scope.organizationId)
      .is("deletedAt", null)
      .maybeSingle(),
    "Invoice not found.",
  ) as Invoice;

  assertInvoiceScope(scope, invoice);

  const [itemsResult, paymentsResult] = await Promise.all([
    db()
      .from(T.InvoiceItem)
      .select("*")
      .eq("invoiceId", invoice.id)
      .order("activityDate", { ascending: true }),
    db()
      .from(T.InvoicePayment)
      .select("*")
      .eq("invoiceId", invoice.id)
      .order("paymentDate", { ascending: false })
      .order("createdAt", { ascending: false }),
  ]);
  const items = (assertDb(itemsResult) ?? []) as InvoiceItem[];
  const payments = (assertDb(paymentsResult) ?? []) as InvoicePayment[];
  const lookups = await fetchLookupMaps({
    organizationId: scope.organizationId,
    invoices: [invoice],
    items,
    payments,
  });
  const listItem = mapInvoiceListItem(invoice, items, lookups);
  const carrier = invoice.carrierId ? lookups.carriers.get(invoice.carrierId) : null;
  const dispatcherUser = invoice.dispatcherId
    ? lookups.dispatcherUsers.get(invoice.dispatcherId)
    : null;
  const team = invoice.teamId ? lookups.teams.get(invoice.teamId) : null;

  if (options.audit !== false) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "INVOICE_VIEWED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        entityName: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        entityDisplayName: listItem.entityName,
      },
    });
  }

  return {
    ...listItem,
    notes: invoice.notes,
    entity: {
      dispatcherName: dispatcherUser?.fullName ?? null,
      dispatcherEmail: dispatcherUser?.email ?? null,
      dispatcherPhone: dispatcherUser?.phoneNumber ?? null,
      carrierName: carrier?.carrierName ?? null,
      driverName: carrier?.driverName ?? null,
      mcNumber: carrier?.mcNumber ?? null,
      truckType: carrier?.truckType ?? null,
      teamName: team?.name ?? null,
    },
    generatedByName: lookups.users.get(invoice.createdById)?.fullName ?? null,
    items: items.map((item) => mapInvoiceDetailItem(item, lookups)),
    payments: payments.map((payment) => mapPayment(payment, lookups)),
  };
}

export async function updateInvoice(
  scope: AccessScope,
  actor: AuthContextUser,
  invoiceId: string,
  rawInput: UpdateInvoiceInput,
): Promise<InvoiceDetail> {
  requireManageAccess(scope);
  const input = updateInvoiceSchema.parse(rawInput);
  const invoice = assertDb(
    await db()
      .from(T.Invoice)
      .select("*")
      .eq("id", invoiceId)
      .eq("organizationId", scope.organizationId)
      .is("deletedAt", null)
      .maybeSingle(),
    "Invoice not found.",
  ) as Invoice;

  if (invoice.invoiceStatus === INVOICE_CANCELLED) {
    throw new ValidationError("Cancelled invoices cannot be edited.");
  }

  const updatePayload: Record<string, unknown> = {
    updatedById: actor.id,
    updatedAt: nowIso(),
  };

  if (input.notes !== undefined) updatePayload.notes = input.notes;
  if (input.issueDate) updatePayload.issueDate = input.issueDate;
  if (input.dueDate) {
    updatePayload.dueDate = input.dueDate;
    updatePayload.invoiceStatus = invoiceStatusForAmounts(
      toAmount(invoice.paidAmount),
      toAmount(invoice.totalAmount),
      input.dueDate,
    );
  }
  if (
    input.invoiceStatus &&
    invoice.paymentStatus !== PAYMENT_PAID &&
    !input.dueDate
  ) {
    updatePayload.invoiceStatus = input.invoiceStatus;
  }

  assertDbVoid(await db().from(T.Invoice).update(updatePayload).eq("id", invoiceId));

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_UPDATED",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: {
      entityName: invoice.invoiceNumber,
      previousStatus: invoice.invoiceStatus,
      updatedStatus:
        (updatePayload.invoiceStatus as InvoiceStatus | undefined) ??
        invoice.invoiceStatus,
      previousPaidAmount: toAmount(invoice.paidAmount),
      updatedPaidAmount: toAmount(invoice.paidAmount),
    },
  });

  return getInvoiceDetail(scope, actor, invoiceId, { audit: false });
}

export async function recordInvoicePayment(
  scope: AccessScope,
  actor: AuthContextUser,
  invoiceId: string,
  rawInput: RecordPaymentInput,
): Promise<InvoiceDetail> {
  requireManageAccess(scope);
  const input = recordPaymentSchema.parse(rawInput);
  const invoice = assertDb(
    await db()
      .from(T.Invoice)
      .select("*")
      .eq("id", invoiceId)
      .eq("organizationId", scope.organizationId)
      .is("deletedAt", null)
      .maybeSingle(),
    "Invoice not found.",
  ) as Invoice;

  if (invoice.invoiceStatus === INVOICE_CANCELLED) {
    throw new ValidationError("Cannot record payment on a cancelled invoice.");
  }

  const pending = toAmount(invoice.pendingAmount);
  if (input.paymentAmount > pending) {
    throw new ValidationError("Payment amount cannot exceed pending amount.");
  }

  const paymentId = createId();
  assertDbVoid(
    await db().from(T.InvoicePayment).insert({
      id: paymentId,
      invoiceId,
      organizationId: scope.organizationId,
      paymentAmount: roundCurrency(input.paymentAmount),
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference ?? null,
      notes: input.notes ?? null,
      recordedById: actor.id,
      createdAt: nowIso(),
    }),
  );

  const paidAmount = roundCurrency(toAmount(invoice.paidAmount) + input.paymentAmount);
  const totalAmount = toAmount(invoice.totalAmount);
  const pendingAmount = roundCurrency(Math.max(totalAmount - paidAmount, 0));
  const paymentStatus = paymentStatusForAmounts(paidAmount, totalAmount);
  const invoiceStatus = invoiceStatusForAmounts(
    paidAmount,
    totalAmount,
    invoice.dueDate,
  );

  assertDbVoid(
    await db()
      .from(T.Invoice)
      .update({
        paidAmount,
        pendingAmount,
        paymentStatus,
        invoiceStatus,
        paidAt: paymentStatus === PAYMENT_PAID ? nowIso() : null,
        updatedById: actor.id,
        updatedAt: nowIso(),
      })
      .eq("id", invoiceId),
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_PAYMENT_RECORDED",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: {
      entityName: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      previousStatus: invoice.invoiceStatus,
      updatedStatus: invoiceStatus,
      previousPaidAmount: toAmount(invoice.paidAmount),
      updatedPaidAmount: paidAmount,
      paymentReference: input.paymentReference ?? null,
      paymentAmount: input.paymentAmount,
    },
  });

  const detail = await getInvoiceDetail(scope, actor, invoiceId, { audit: false });
  await notifyDispatcherInvoice({
    organizationId: scope.organizationId,
    dispatcherId: detail.invoiceType === INVOICE_DISPATCHER_PAYABLE ? detail.items[0]?.dispatcherId ?? null : null,
    title:
      paymentStatus === PAYMENT_PAID ? "Invoice paid" : "Invoice payment recorded",
    message: `${detail.invoiceNumber} payment of $${input.paymentAmount.toFixed(2)} was recorded.`,
    invoiceId,
    invoiceNumber: detail.invoiceNumber,
    teamId: detail.items[0]?.teamId ?? null,
  });

  return detail;
}

export async function markInvoicePaid(
  scope: AccessScope,
  actor: AuthContextUser,
  invoiceId: string,
  input?: {
    paymentDate?: string;
    paymentMethod?: InvoicePaymentMethod;
    paymentReference?: string;
    notes?: string;
  },
): Promise<InvoiceDetail> {
  const invoice = await getInvoiceDetail(scope, actor, invoiceId, { audit: false });
  if (invoice.pendingAmount <= 0) {
    return invoice;
  }

  const detail = await recordInvoicePayment(scope, actor, invoiceId, {
    paymentAmount: invoice.pendingAmount,
    paymentDate: input?.paymentDate ?? todayKey(),
    paymentMethod: input?.paymentMethod ?? "OTHER",
    paymentReference: input?.paymentReference ?? "Marked paid",
    notes: input?.notes ?? "Marked paid by admin.",
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_MARKED_PAID",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: {
      entityName: detail.invoiceNumber,
      invoiceType: detail.invoiceType,
      previousStatus: invoice.invoiceStatus,
      updatedStatus: detail.invoiceStatus,
      previousPaidAmount: invoice.paidAmount,
      updatedPaidAmount: detail.paidAmount,
    },
  });

  return detail;
}

export async function cancelInvoice(
  scope: AccessScope,
  actor: AuthContextUser,
  invoiceId: string,
  notes?: string,
): Promise<InvoiceDetail> {
  requireManageAccess(scope);
  const invoice = assertDb(
    await db()
      .from(T.Invoice)
      .select("*")
      .eq("id", invoiceId)
      .eq("organizationId", scope.organizationId)
      .is("deletedAt", null)
      .maybeSingle(),
    "Invoice not found.",
  ) as Invoice;

  if (invoice.paymentStatus === PAYMENT_PAID) {
    throw new ValidationError("Paid invoices cannot be cancelled.");
  }

  assertDbVoid(
    await db()
      .from(T.Invoice)
      .update({
        invoiceStatus: INVOICE_CANCELLED,
        cancelledAt: nowIso(),
        notes: notes ?? invoice.notes,
        updatedById: actor.id,
        updatedAt: nowIso(),
      })
      .eq("id", invoiceId),
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_CANCELLED",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: {
      entityName: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      previousStatus: invoice.invoiceStatus,
      updatedStatus: INVOICE_CANCELLED,
      previousPaidAmount: toAmount(invoice.paidAmount),
      updatedPaidAmount: toAmount(invoice.paidAmount),
      notes: notes ?? null,
    },
  });

  return getInvoiceDetail(scope, actor, invoiceId, { audit: false });
}

export async function exportInvoice(
  scope: AccessScope,
  actor: AuthContextUser,
  invoiceId: string,
  format: "pdf" | "csv" | "payments-csv" = "pdf",
): Promise<{ fileName: string; csv?: string; invoice?: InvoiceDetail }> {
  const detail = await getInvoiceDetail(scope, actor, invoiceId, { audit: false });
  const slug = detail.invoiceNumber.toLowerCase();

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_EXPORTED",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: {
      entityName: detail.invoiceNumber,
      invoiceType: detail.invoiceType,
      entityDisplayName: detail.entityName,
      exportFormat: format,
      rowCount:
        format === "payments-csv" ? detail.payments.length : detail.items.length,
    },
  });

  if (format === "pdf") {
    return { fileName: `${slug}.pdf`, invoice: detail };
  }

  if (format === "payments-csv") {
    const rows = [
      ["Payment Date", "Amount", "Method", "Reference", "Recorded By", "Notes"],
      ...detail.payments.map((payment) => [
        payment.paymentDate,
        payment.paymentAmount.toFixed(2),
        payment.paymentMethod,
        payment.paymentReference ?? "",
        payment.recordedByName ?? "",
        payment.notes ?? "",
      ]),
    ];
    return { fileName: `${slug}-payments.csv`, csv: buildCsv(rows) };
  }

  const rows = [
    ["Invoice", detail.invoiceNumber],
    ["Type", detail.invoiceType],
    ["Entity", detail.entityName],
    ["Period", `${detail.periodStart} to ${detail.periodEnd}`],
    ["Total", detail.totalAmount.toFixed(2)],
    ["Paid", detail.paidAmount.toFixed(2)],
    ["Pending", detail.pendingAmount.toFixed(2)],
    [],
    [
      "Date",
      "Carrier",
      "Dispatcher",
      "Team",
      "Status",
      "Origin",
      "Destination",
      "Miles",
      "Load Amount",
      "Rate Per Mile",
      "Dispatch Fee",
      "Item Amount",
      "Notes/Reason",
    ],
    ...detail.items.map((item) => [
      item.activityDate,
      item.carrierName,
      item.dispatcherName,
      item.teamName,
      item.status,
      item.origin ?? "",
      item.destination ?? "",
      item.totalMiles?.toString() ?? "",
      item.loadAmount?.toFixed(2) ?? "",
      item.ratePerMile?.toFixed(4) ?? "",
      item.dispatchFee?.toFixed(2) ?? "",
      item.amount.toFixed(2),
      item.itemDescription ?? "",
    ]),
  ];

  return { fileName: `${slug}.csv`, csv: buildCsv(rows) };
}

export async function getInvoiceDashboard(
  scope: AccessScope,
): Promise<InvoiceDashboardBundle> {
  const { invoices, items, lookups } = await loadInvoiceRows(scope, {});
  const itemsByInvoice = new Map<string, InvoiceItem[]>();
  for (const item of items) {
    const bucket = itemsByInvoice.get(item.invoiceId) ?? [];
    bucket.push(item);
    itemsByInvoice.set(item.invoiceId, bucket);
  }
  return buildDashboard(
    invoices.map((invoice) =>
      mapInvoiceListItem(invoice, itemsByInvoice.get(invoice.id) ?? [], lookups),
    ),
  );
}

export async function exportInvoiceListCsv(
  scope: AccessScope,
  actor: AuthContextUser,
  filters: InvoiceFilters = {},
): Promise<{ fileName: string; csv: string }> {
  const bundle = await listInvoices(scope, actor, filters);
  const rows = [
    [
      "Invoice ID",
      "Type",
      "Entity",
      "Team",
      "Period Start",
      "Period End",
      "Issue Date",
      "Due Date",
      "Total Amount",
      "Paid Amount",
      "Pending Amount",
      "Status",
      "Payment Status",
    ],
    ...bundle.invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.invoiceType,
      invoice.entityName,
      invoice.teamName ?? "",
      invoice.periodStart,
      invoice.periodEnd,
      invoice.issueDate,
      invoice.dueDate,
      invoice.totalAmount.toFixed(2),
      invoice.paidAmount.toFixed(2),
      invoice.pendingAmount.toFixed(2),
      invoice.invoiceStatus,
      invoice.paymentStatus,
    ]),
  ];

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "INVOICE_EXPORTED",
    entityType: "Invoice",
    entityId: null,
    metadata: {
      entityName: "Invoice List",
      exportFormat: "csv",
      filters,
      rowCount: bundle.invoices.length,
    },
  });

  return {
    fileName: `invoices-${todayKey()}.csv`,
    csv: buildCsv(rows),
  };
}
