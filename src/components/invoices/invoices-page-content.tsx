"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileDown,
  Filter,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppToast } from "@/components/feedback/app-toast";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INVOICE_CARRIER_RECEIVABLE,
  INVOICE_DISPATCHER_PAYABLE,
  INVOICE_PAYMENT_METHOD_LABELS,
  INVOICE_PAYMENT_METHODS,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPES,
  PAYMENT_STATUS_LABELS,
  type InvoicePaymentMethod,
  type InvoiceType,
} from "@/lib/constants/invoices";
import {
  cancelInvoiceRequest,
  exportInvoiceRequest,
  fetchInvoiceDetail,
  fetchInvoices,
  generateInvoiceRequest,
  markInvoicePaidRequest,
  recordInvoicePaymentRequest,
} from "@/lib/api/resources";
import { ApiClientError } from "@/lib/api/client";
import { exportInvoiceListPdf } from "@/lib/invoices/export-invoice-list-pdf";
import { exportInvoicePdf } from "@/lib/invoices/export-invoice-pdf";
import type {
  InvoiceDetail,
  InvoiceListBundle,
  InvoiceListItem,
  InvoicePreview,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import { cn } from "@/lib/utils";
import { useApiData } from "@/hooks/use-api-data";

type InvoicePageVariant = "admin" | "dispatcher" | "team-lead";
type InvoiceTab =
  | "all"
  | "dispatcher"
  | "carrier"
  | "paid"
  | "pending"
  | "overdue";

type Filters = {
  invoiceType: string;
  invoiceStatus: string;
  paymentStatus: string;
  teamId: string;
  dispatcherId: string;
  carrierId: string;
  dateFrom: string;
  dateTo: string;
  q: string;
  overdue: boolean;
};

type GenerateForm = {
  invoiceType: InvoiceType;
  dispatcherId: string;
  carrierId: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  notes: string;
};

type PaymentForm = {
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  paymentReference: string;
  notes: string;
};

const DEFAULT_FILTERS: Filters = {
  invoiceType: "",
  invoiceStatus: "",
  paymentStatus: "",
  teamId: "",
  dispatcherId: "",
  carrierId: "",
  dateFrom: "",
  dateTo: "",
  q: "",
  overdue: false,
};

const TAB_LABELS: Record<InvoiceTab, string> = {
  all: "All Invoices",
  dispatcher: "Dispatcher Payables",
  carrier: "Carrier Receivables",
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
};

const MONEY_TICK = (value: number) =>
  value >= 1000 ? `${Math.round(value / 1000)}K` : String(value);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultDueDate() {
  const due = new Date();
  due.setDate(due.getDate() + 15);
  return due.toISOString().slice(0, 10);
}

const DEFAULT_GENERATE_FORM: GenerateForm = {
  invoiceType: INVOICE_DISPATCHER_PAYABLE,
  dispatcherId: "",
  carrierId: "",
  periodStart: monthStartKey(),
  periodEnd: todayKey(),
  issueDate: todayKey(),
  dueDate: defaultDueDate(),
  notes: "",
};

function filtersToParams(filters: Filters): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      invoiceType: filters.invoiceType,
      invoiceStatus: filters.invoiceStatus,
      paymentStatus: filters.paymentStatus,
      teamId: filters.teamId,
      dispatcherId: filters.dispatcherId,
      carrierId: filters.carrierId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      q: filters.q,
      overdue: filters.overdue ? "true" : "",
    }).filter(([, value]) => value),
  );
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDateLabel(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function compactMoney(value: number) {
  return formatCurrency(value, {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function hasActiveFilters(filters: Filters) {
  return Object.entries(filters).some(([key, value]) =>
    key === "overdue" ? value === true : Boolean(value),
  );
}

function invoiceMatchesTab(invoice: InvoiceListItem, tab: InvoiceTab) {
  if (tab === "all") return true;
  if (tab === "dispatcher") {
    return invoice.invoiceType === INVOICE_DISPATCHER_PAYABLE;
  }
  if (tab === "carrier") {
    return invoice.invoiceType === INVOICE_CARRIER_RECEIVABLE;
  }
  if (tab === "paid") return invoice.paymentStatus === "PAID";
  if (tab === "pending") {
    return invoice.paymentStatus !== "PAID" && invoice.invoiceStatus !== "CANCELLED";
  }
  return invoice.invoiceStatus === "OVERDUE";
}

function tabCount(invoices: InvoiceListItem[], tab: InvoiceTab) {
  return invoices.filter((invoice) => invoiceMatchesTab(invoice, tab)).length;
}

function invoicePeriodLabel(invoice: InvoiceListItem) {
  return `${shortDateLabel(invoice.periodStart)} - ${dateLabel(invoice.periodEnd)}`;
}

function statusClass(status: string, kind: "invoice" | "payment" | "type") {
  if (kind === "type") {
    return status === INVOICE_DISPATCHER_PAYABLE
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : "border-teal-200 bg-teal-50 text-teal-700";
  }

  if (status === "PAID") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "PARTIALLY_PAID") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "OVERDUE") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "CANCELLED") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  if (status === "UNPAID") {
    return "border-red-100 bg-red-50 text-red-700";
  }
  if (status === "ISSUED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-white text-slate-600";
}

function StatusBadge({
  status,
  kind,
}: {
  status: string;
  kind: "invoice" | "payment" | "type";
}) {
  const label =
    kind === "type"
      ? INVOICE_TYPE_LABELS[status as InvoiceType]
      : kind === "payment"
        ? PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS]
        : INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS];

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        statusClass(status, kind),
      )}
    >
      {label}
    </Badge>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      className={cn(
        "h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10",
        className,
      )}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function ToolbarInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className={cn("relative", className)}>
      {Icon ? (
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
      ) : null}
      <Input
        className={cn(
          "h-10 rounded-lg border-[#E2E8F0] bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus-visible:border-[#2563EB] focus-visible:ring-[#2563EB]/15",
          Icon && "pl-9",
        )}
        {...props}
      />
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-sm text-[#64748B]">
      {label}
    </div>
  );
}

export function InvoicesPageContent({ variant }: { variant: InvoicePageVariant }) {
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<InvoiceTab>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItem | null>(null);
  const [generateForm, setGenerateForm] = useState<GenerateForm>(DEFAULT_GENERATE_FORM);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    paymentAmount: "",
    paymentDate: todayKey(),
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "",
    notes: "",
  });
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const loadInvoices = useCallback(
    () => fetchInvoices(variant, filtersToParams(appliedFilters)),
    [appliedFilters, variant],
  );
  const { data, error, isLoading, reload } = useApiData<InvoiceListBundle>(
    loadInvoices,
    [appliedFilters, variant],
  );

  const canManage = variant === "admin";
  const pageTitle =
    variant === "dispatcher"
      ? "My Invoices"
      : variant === "team-lead"
        ? "Team Invoices"
        : "Invoices";
  const pageDescription =
    variant === "admin"
      ? "Manage dispatcher payables, carrier receivables, payment status, exports, and invoice records."
      : variant === "dispatcher"
        ? "View dispatcher payable invoices, payment status, and invoice exports."
        : "Review team-scoped dispatcher payables, carrier receivables, and invoice status.";

  const invoices = useMemo(() => data?.invoices ?? [], [data?.invoices]);
  const displayedInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceMatchesTab(invoice, activeTab)),
    [activeTab, invoices],
  );
  const totalPages = Math.max(1, Math.ceil(displayedInvoices.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedInvoices = displayedInvoices.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );
  const metrics = data?.dashboard.metrics;

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : data && displayedInvoices.length === 0
        ? "empty"
        : "ready";

  const filteredCarriers = useMemo(() => {
    if (!data) return [];
    return data.filterOptions.carriers.filter((carrier) => {
      if (generateForm.invoiceType === INVOICE_CARRIER_RECEIVABLE) {
        return true;
      }
      return !generateForm.dispatcherId || carrier.dispatcherId === generateForm.dispatcherId;
    });
  }, [data, generateForm.dispatcherId, generateForm.invoiceType]);

  const chartData = useMemo(
    () => [
      {
        label: "Dispatcher",
        paid: metrics?.dispatcherPaidAmount ?? 0,
        pending: metrics?.dispatcherPendingAmount ?? 0,
      },
      {
        label: "Carrier",
        paid: metrics?.carrierPaidAmount ?? 0,
        pending: metrics?.carrierPendingAmount ?? 0,
      },
    ],
    [metrics],
  );

  const monthlyTrend = data?.dashboard.monthlyTrend ?? [];
  const donutData = useMemo(() => {
    const paid = metrics?.paidAmount ?? 0;
    const pending =
      (metrics?.dispatcherPendingAmount ?? 0) + (metrics?.carrierPendingAmount ?? 0);
    const overdue = metrics?.overdueAmount ?? 0;
    const total = Math.max(paid + pending + overdue, 0);
    return [
      { name: "Paid", value: paid, color: "#14B8A6" },
      { name: "Pending", value: pending, color: "#F59E0B" },
      { name: "Overdue", value: overdue, color: "#EF4444" },
    ].map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
    }));
  }, [metrics]);
  const donutTotal = donutData.reduce((sum, item) => sum + item.value, 0);

  function applyTab(tab: InvoiceTab) {
    setActiveTab(tab);
    setPage(1);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setPage(1);
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setActiveTab("all");
    setPage(1);
  }

  async function openDetail(invoice: InvoiceListItem) {
    setIsWorking(true);
    try {
      const loaded = await fetchInvoiceDetail(variant, invoice.id);
      setDetail(loaded);
      setIsDetailOpen(true);
    } catch (detailError) {
      setToast(errorMessage(detailError, "Unable to load invoice details."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handlePreview() {
    setIsWorking(true);
    try {
      const result = await generateInvoiceRequest({
        ...generateForm,
        dispatcherId:
          generateForm.invoiceType === INVOICE_DISPATCHER_PAYABLE
            ? generateForm.dispatcherId
            : undefined,
        carrierId:
          generateForm.invoiceType === INVOICE_CARRIER_RECEIVABLE
            ? generateForm.carrierId
            : undefined,
        previewOnly: true,
      });
      if ("activityCount" in result) {
        setPreview(result);
      }
    } catch (previewError) {
      setToast(errorMessage(previewError, "Unable to preview invoice."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleGenerate() {
    setIsWorking(true);
    try {
      const result = await generateInvoiceRequest({
        ...generateForm,
        dispatcherId:
          generateForm.invoiceType === INVOICE_DISPATCHER_PAYABLE
            ? generateForm.dispatcherId
            : undefined,
        carrierId:
          generateForm.invoiceType === INVOICE_CARRIER_RECEIVABLE
            ? generateForm.carrierId
            : undefined,
      });
      if ("invoiceNumber" in result) {
        setToast(`${result.invoiceNumber} generated.`);
      }
      setPreview(null);
      setIsGenerateOpen(false);
      await reload();
    } catch (generateError) {
      setToast(errorMessage(generateError, "Unable to generate invoice."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRecordPayment() {
    if (!selectedInvoice) return;
    setIsWorking(true);
    try {
      await recordInvoicePaymentRequest(selectedInvoice.id, {
        ...paymentForm,
        paymentAmount: Number(paymentForm.paymentAmount),
      });
      setToast("Payment recorded.");
      setIsPaymentOpen(false);
      setSelectedInvoice(null);
      await reload();
    } catch (paymentError) {
      setToast(errorMessage(paymentError, "Unable to record payment."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMarkPaid(invoice: InvoiceListItem) {
    setIsWorking(true);
    try {
      await markInvoicePaidRequest(invoice.id);
      setToast(`${invoice.invoiceNumber} marked paid.`);
      await reload();
    } catch (markError) {
      setToast(errorMessage(markError, "Unable to mark invoice paid."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCancel(invoice: InvoiceListItem) {
    if (!window.confirm(`Cancel ${invoice.invoiceNumber}?`)) return;
    setIsWorking(true);
    try {
      await cancelInvoiceRequest(invoice.id, "Cancelled from invoice page.");
      setToast(`${invoice.invoiceNumber} cancelled.`);
      await reload();
    } catch (cancelError) {
      setToast(errorMessage(cancelError, "Unable to cancel invoice."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleExport(invoice: InvoiceListItem, format: "pdf" | "csv") {
    setIsWorking(true);
    try {
      const result = await exportInvoiceRequest(variant, invoice.id, { format });
      if (format === "pdf" && result.invoice) {
        await exportInvoicePdf(result.invoice);
      } else if (result.csv) {
        downloadCsv(result.fileName, result.csv);
      }
      setToast(`${invoice.invoiceNumber} exported.`);
    } catch (exportError) {
      setToast(errorMessage(exportError, "Unable to export invoice."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleExportAll() {
    setIsWorking(true);
    try {
      if (!data) {
        return;
      }

      await exportInvoiceListPdf({
        invoices: data.invoices,
        dashboard: data.dashboard,
        filterLabel: hasActiveFilters(appliedFilters)
          ? "Filtered invoice register"
          : "All visible invoices",
      });
      setToast("Invoice PDF downloaded.");
    } catch (exportError) {
      setToast(errorMessage(exportError, "Unable to export invoice PDF."));
    } finally {
      setIsWorking(false);
    }
  }

  function openPayment(invoice: InvoiceListItem) {
    setSelectedInvoice(invoice);
    setPaymentForm({
      paymentAmount: invoice.pendingAmount.toFixed(2),
      paymentDate: todayKey(),
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "",
      notes: "",
    });
    setIsPaymentOpen(true);
  }

  const actions = canManage ? (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Button
        className="h-10 rounded-lg bg-[#2563EB] px-4 shadow-[0_8px_18px_rgba(37,99,235,0.25)] hover:bg-[#1D4ED8]"
        onClick={() => setIsGenerateOpen(true)}
      >
        <Plus className="size-4" />
        Generate Invoice
      </Button>
      <Button
        variant="outline"
        className="h-10 rounded-lg border-[#DCE3EF] bg-white px-4 text-[#334155] hover:bg-[#F8FAFC]"
        onClick={() => {
          setGenerateForm({
            ...DEFAULT_GENERATE_FORM,
            periodStart: monthStartKey(),
            periodEnd: todayKey(),
          });
          setIsGenerateOpen(true);
        }}
      >
        <Calendar className="size-4" />
        Monthly Generate
      </Button>
      <Button
        variant="outline"
        className="h-10 rounded-lg border-[#DCE3EF] bg-white px-4 text-[#334155] hover:bg-[#F8FAFC]"
        onClick={handleExportAll}
      >
        <Download className="size-4" />
        Export All PDF
      </Button>
    </div>
  ) : null;

  return (
    <PageShell title={pageTitle} description={pageDescription} actions={actions}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            icon={ReceiptText}
            label="Total Invoices"
            value={(metrics?.totalInvoices ?? 0).toLocaleString()}
            subtext="All time / selected period"
            tone="blue"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Paid Invoices"
            value={`${(metrics?.paidInvoices ?? 0).toLocaleString()} / ${compactMoney(metrics?.paidAmount ?? 0)}`}
            subtext="This period"
            tone="green"
          />
          <KpiCard
            icon={Clock3}
            label="Pending Invoices"
            value={`${((metrics?.unpaidInvoices ?? 0) + (metrics?.partiallyPaidInvoices ?? 0)).toLocaleString()} / ${compactMoney((metrics?.unpaidAmount ?? 0) + (metrics?.partiallyPaidAmount ?? 0))}`}
            subtext="This period"
            tone="amber"
          />
          <KpiCard
            icon={UserRound}
            label="Dispatcher Payables"
            value={`${compactMoney(metrics?.dispatcherPaidAmount ?? 0)} paid`}
            subtext={`${compactMoney(metrics?.dispatcherPendingAmount ?? 0)} pending`}
            tone="violet"
          />
          <KpiCard
            icon={Truck}
            label="Carrier Receivables"
            value={`${compactMoney(metrics?.carrierPaidAmount ?? 0)} paid`}
            subtext={`${compactMoney(metrics?.carrierPendingAmount ?? 0)} pending`}
            tone="teal"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Overdue"
            value={`${(metrics?.overdueInvoices ?? 0).toLocaleString()} / ${compactMoney(metrics?.overdueAmount ?? 0)}`}
            subtext="Invoices due"
            tone="red"
          />
        </div>

        <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
          <ChartCard title="Paid vs Pending" eyebrow="This period">
            {chartData.some((item) => item.paid > 0 || item.pending > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 6 }}>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={MONEY_TICK} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(37,99,235,0.05)" }} />
                  <Bar dataKey="paid" name="Paid" fill="#14B8A6" radius={[6, 6, 0, 0]} maxBarSize={70} />
                  <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={70} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No paid or pending invoice amounts yet." />
            )}
          </ChartCard>

          <ChartCard title="Monthly Invoice Trend" eyebrow="Last 6 months">
            <div className="grid h-full gap-4 lg:grid-cols-[1fr_220px]">
              <div className="min-h-72">
                {monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend} margin={{ top: 16, right: 10, left: 0, bottom: 6 }}>
                      <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={MONEY_TICK} />
                      <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(37,99,235,0.05)" }} />
                      <Bar dataKey="totalAmount" name="Total" fill="#2563EB" radius={[5, 5, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="paidAmount" name="Paid" fill="#14B8A6" radius={[5, 5, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="pendingAmount" name="Pending" fill="#F59E0B" radius={[5, 5, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="No monthly invoice trend available yet." />
                )}
              </div>
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-[#F8FAFC] p-4">
                <div className="relative h-36 w-36">
                  {donutTotal > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          innerRadius={42}
                          outerRadius={62}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {donutData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full rounded-full border-[16px] border-[#E2E8F0]" />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] text-[#64748B]">Total</span>
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {compactMoney(donutTotal)}
                    </span>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  {donutData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="flex-1 text-[#475569]">{item.name}</span>
                      <span className="font-medium text-[#0F172A]">{item.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        <InvoiceTabs
          activeTab={activeTab}
          invoices={invoices}
          onChange={applyTab}
        />

        {data ? (
          <InvoiceFilters
            values={draftFilters}
            bundle={data}
            showEntityFilters={variant !== "dispatcher"}
            onChange={setDraftFilters}
            onApply={applyFilters}
            onReset={resetFilters}
          />
        ) : null}

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading invoices"
          errorTitle="Unable to load invoices"
          errorDescription={error ?? undefined}
          emptyTitle="No invoices found"
          emptyDescription="Generate your first dispatcher payable or carrier receivable invoice."
          emptyActionLabel={canManage ? "Generate Invoice" : undefined}
          onEmptyAction={canManage ? () => setIsGenerateOpen(true) : undefined}
        >
          {data ? (
            <InvoiceTableCard
              invoices={pagedInvoices}
              allCount={displayedInvoices.length}
              page={safePage}
              totalPages={totalPages}
              perPage={perPage}
              canManage={canManage}
              hasFilters={hasActiveFilters(appliedFilters) || activeTab !== "all"}
              onPageChange={setPage}
              onPerPageChange={(next) => {
                setPerPage(next);
                setPage(1);
              }}
              onClearFilters={resetFilters}
              onGenerate={() => setIsGenerateOpen(true)}
              onView={openDetail}
              onRecordPayment={openPayment}
              onMarkPaid={handleMarkPaid}
              onExport={handleExport}
              onCancel={handleCancel}
            />
          ) : null}
        </PageContentGate>
      </div>

      <GenerateInvoiceDialog
        open={isGenerateOpen}
        form={generateForm}
        data={data ?? null}
        preview={preview}
        filteredCarriers={filteredCarriers}
        isWorking={isWorking}
        onOpenChange={setIsGenerateOpen}
        onFormChange={(next) => {
          setGenerateForm(next);
          setPreview(null);
        }}
        onPreview={handlePreview}
        onGenerate={handleGenerate}
      />
      <PaymentDialog
        open={isPaymentOpen}
        invoice={selectedInvoice}
        form={paymentForm}
        isWorking={isWorking}
        onOpenChange={setIsPaymentOpen}
        onFormChange={setPaymentForm}
        onSubmit={handleRecordPayment}
      />
      <InvoiceDetailDialog
        open={isDetailOpen}
        invoice={detail}
        isWorking={isWorking}
        onOpenChange={setIsDetailOpen}
        onExportPdf={(invoice) => exportInvoicePdf(invoice)}
      />
      <AppToast message={toast} onDismiss={() => setToast(null)} />
    </PageShell>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext: string;
  tone: "blue" | "green" | "amber" | "violet" | "teal" | "red";
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    teal: "bg-teal-50 text-teal-600",
    red: "bg-red-50 text-red-600",
  }[tone];

  const subtextClasses = {
    blue: "text-[#64748B]",
    green: "text-[#64748B]",
    amber: "text-[#64748B]",
    violet: "text-violet-600",
    teal: "text-teal-600",
    red: "text-[#64748B]",
  }[tone];

  return (
    <Card className="rounded-xl border border-[#E2E8F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardContent className="flex min-h-[118px] items-center gap-4 p-5">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", toneClasses)}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#64748B]">{label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A]">{value}</p>
          <p className={cn("mt-1 text-xs", subtextClasses)}>{subtext}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-xl border border-[#E2E8F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader className="flex flex-row items-center justify-between px-5 pt-4 pb-0">
        <div>
          <CardTitle className="text-base font-semibold text-[#0F172A]">{title}</CardTitle>
          <div className="mt-3 flex items-center gap-5 text-xs text-[#475569]">
            <ChartLegend color="#2563EB" label="Total" hidden={title === "Paid vs Pending"} />
            <ChartLegend color="#14B8A6" label="Paid" />
            <ChartLegend color="#F59E0B" label="Pending" />
          </div>
        </div>
        <span className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#475569]">
          {eyebrow}
        </span>
      </CardHeader>
      <CardContent className="h-[320px] px-5 pb-5 pt-3">{children}</CardContent>
    </Card>
  );
}

function ChartLegend({
  color,
  label,
  hidden,
}: {
  color: string;
  label: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-[#0F172A]">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex min-w-36 items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-[#64748B]">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-medium text-[#0F172A]">{compactMoney(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceTabs({
  activeTab,
  invoices,
  onChange,
}: {
  activeTab: InvoiceTab;
  invoices: InvoiceListItem[];
  onChange: (tab: InvoiceTab) => void;
}) {
  const tabs: InvoiceTab[] = ["all", "dispatcher", "carrier", "paid", "pending", "overdue"];
  return (
    <div className="flex gap-7 overflow-x-auto border-b border-[#E2E8F0]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const count = tabCount(invoices, tab);
        return (
          <button
            key={tab}
            type="button"
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-2 text-sm font-medium text-[#475569] transition-colors",
              isActive && "text-[#2563EB]",
            )}
            onClick={() => onChange(tab)}
          >
            {TAB_LABELS[tab]}
            {tab === "overdue" && count > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {count}
              </span>
            ) : null}
            {isActive ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#2563EB]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function InvoiceFilters({
  values,
  bundle,
  showEntityFilters,
  onChange,
  onApply,
  onReset,
}: {
  values: Filters;
  bundle: InvoiceListBundle;
  showEntityFilters: boolean;
  onChange: (values: Filters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <Card className="rounded-xl border border-[#E2E8F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <ToolbarInput
          icon={Search}
          placeholder="Search invoices..."
          value={values.q}
          onChange={(event) => onChange({ ...values, q: event.target.value })}
          className="2xl:col-span-2"
        />
        <NativeSelect value={values.invoiceType} onChange={(invoiceType) => onChange({ ...values, invoiceType })}>
          <option value="">All types</option>
          {INVOICE_TYPES.map((type) => (
            <option key={type} value={type}>{INVOICE_TYPE_LABELS[type]}</option>
          ))}
        </NativeSelect>
        <NativeSelect value={values.paymentStatus} onChange={(paymentStatus) => onChange({ ...values, paymentStatus })}>
          <option value="">All payment statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
        </NativeSelect>
        <NativeSelect value={values.invoiceStatus} onChange={(invoiceStatus) => onChange({ ...values, invoiceStatus })}>
          <option value="">All invoice statuses</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>{INVOICE_STATUS_LABELS[status]}</option>
          ))}
        </NativeSelect>
        {showEntityFilters ? (
          <>
            <NativeSelect value={values.teamId} onChange={(teamId) => onChange({ ...values, teamId })}>
              <option value="">All teams</option>
              {bundle.filterOptions.teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </NativeSelect>
            <NativeSelect value={values.dispatcherId} onChange={(dispatcherId) => onChange({ ...values, dispatcherId })}>
              <option value="">All dispatchers</option>
              {bundle.filterOptions.dispatchers.map((dispatcher) => (
                <option key={dispatcher.id} value={dispatcher.id}>{dispatcher.name}</option>
              ))}
            </NativeSelect>
            <NativeSelect value={values.carrierId} onChange={(carrierId) => onChange({ ...values, carrierId })} className="2xl:col-span-2">
              <option value="">All carriers</option>
              {bundle.filterOptions.carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
              ))}
            </NativeSelect>
          </>
        ) : null}
        <ToolbarInput
          icon={Calendar}
          type="date"
          value={values.dateFrom}
          onChange={(event) => onChange({ ...values, dateFrom: event.target.value })}
        />
        <ToolbarInput
          icon={Calendar}
          type="date"
          value={values.dateTo}
          onChange={(event) => onChange({ ...values, dateTo: event.target.value })}
        />
        <label className="flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-[#334155]">
          <span
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              values.overdue ? "bg-[#2563EB]" : "bg-[#E2E8F0]",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={values.overdue}
              onChange={(event) => onChange({ ...values, overdue: event.target.checked })}
            />
            <span
              className={cn(
                "size-5 rounded-full bg-white shadow transition-transform",
                values.overdue ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </span>
          Overdue only
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-2 2xl:col-span-2">
          <Button className="h-10 flex-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8]" onClick={onApply}>
            <Filter className="size-4" />
            Apply Filters
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-[#DCE3EF] bg-white" onClick={onReset}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceTableCard({
  invoices,
  allCount,
  page,
  totalPages,
  perPage,
  canManage,
  hasFilters,
  onPageChange,
  onPerPageChange,
  onClearFilters,
  onGenerate,
  onView,
  onRecordPayment,
  onMarkPaid,
  onExport,
  onCancel,
}: {
  invoices: InvoiceListItem[];
  allCount: number;
  page: number;
  totalPages: number;
  perPage: number;
  canManage: boolean;
  hasFilters: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onClearFilters: () => void;
  onGenerate: () => void;
  onView: (invoice: InvoiceListItem) => void;
  onRecordPayment: (invoice: InvoiceListItem) => void;
  onMarkPaid: (invoice: InvoiceListItem) => void;
  onExport: (invoice: InvoiceListItem, format: "pdf" | "csv") => void;
  onCancel: (invoice: InvoiceListItem) => void;
}) {
  if (invoices.length === 0) {
    return (
      <Card className="rounded-xl border border-[#E2E8F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-blue-50 text-[#2563EB]">
            <ReceiptText className="size-10" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-[#0F172A]">No invoices found</h3>
          <p className="mt-2 max-w-md text-sm text-[#64748B]">
            Generate your first dispatcher payable or carrier receivable invoice.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {canManage ? (
              <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]" onClick={onGenerate}>
                <Plus className="size-4" />
                Generate Invoice
              </Button>
            ) : null}
            {hasFilters ? (
              <Button variant="outline" onClick={onClearFilters}>
                Clear Filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-[#E2E8F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1180px]">
            <TableHeader className="bg-[#F8FAFC]">
              <TableRow className="border-[#E2E8F0] hover:bg-[#F8FAFC]">
                <TableHead className="h-12 px-5 text-xs font-semibold text-[#0F172A]">Invoice ID</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Type</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Entity</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Team</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Period</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Due Date</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Total</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Paid</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Pending</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Status</TableHead>
                <TableHead className="h-12 text-xs font-semibold text-[#0F172A]">Payment</TableHead>
                <TableHead className="h-12 pr-5 text-right text-xs font-semibold text-[#0F172A]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-[#E2E8F0] hover:bg-[#F8FAFC]/80">
                  <TableCell className="px-5 py-3">
                    <button
                      type="button"
                      className="font-semibold text-[#2563EB] hover:underline"
                      onClick={() => onView(invoice)}
                    >
                      {invoice.invoiceNumber}
                    </button>
                  </TableCell>
                  <TableCell><StatusBadge kind="type" status={invoice.invoiceType} /></TableCell>
                  <TableCell className="font-medium text-[#334155]">{invoice.entityName}</TableCell>
                  <TableCell className="text-[#475569]">{invoice.teamName ?? "-"}</TableCell>
                  <TableCell className="text-[#475569]">{invoicePeriodLabel(invoice)}</TableCell>
                  <TableCell className="text-[#475569]">{dateLabel(invoice.dueDate)}</TableCell>
                  <TableCell className="font-medium text-[#0F172A]">{formatCurrency(invoice.totalAmount)}</TableCell>
                  <TableCell className="font-semibold text-[#14B8A6]">{formatCurrency(invoice.paidAmount)}</TableCell>
                  <TableCell className="font-semibold text-[#F59E0B]">{formatCurrency(invoice.pendingAmount)}</TableCell>
                  <TableCell><StatusBadge kind="invoice" status={invoice.invoiceStatus} /></TableCell>
                  <TableCell><StatusBadge kind="payment" status={invoice.paymentStatus} /></TableCell>
                  <TableCell className="pr-5 text-right">
                    <InvoiceActionsMenu
                      invoice={invoice}
                      canManage={canManage}
                      onView={onView}
                      onRecordPayment={onRecordPayment}
                      onMarkPaid={onMarkPaid}
                      onExport={onExport}
                      onCancel={onCancel}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#E2E8F0] px-5 py-3 text-sm text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {allCount === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, allCount)} of {allCount} results
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={String(perPage)} onChange={(value) => onPerPageChange(Number(value))} className="h-9 w-32">
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </NativeSelect>
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
              <Button
                key={pageNumber}
                variant={pageNumber === page ? "default" : "outline"}
                size="icon-sm"
                className={pageNumber === page ? "bg-[#2563EB]" : "bg-white"}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </Button>
            ))}
            {totalPages > 5 ? <span className="px-2">...</span> : null}
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceActionsMenu({
  invoice,
  canManage,
  onView,
  onRecordPayment,
  onMarkPaid,
  onExport,
  onCancel,
}: {
  invoice: InvoiceListItem;
  canManage: boolean;
  onView: (invoice: InvoiceListItem) => void;
  onRecordPayment: (invoice: InvoiceListItem) => void;
  onMarkPaid: (invoice: InvoiceListItem) => void;
  onExport: (invoice: InvoiceListItem, format: "pdf" | "csv") => void;
  onCancel: (invoice: InvoiceListItem) => void;
}) {
  const paymentDisabled = invoice.pendingAmount <= 0 || invoice.invoiceStatus === "CANCELLED";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F1F5F9]"
        aria-label={`Actions for ${invoice.invoiceNumber}`}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => onView(invoice)}>
          <Eye className="size-4" />
          View Invoice
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem disabled={paymentDisabled} onClick={() => onRecordPayment(invoice)}>
              <WalletCards className="size-4" />
              Record Payment
            </DropdownMenuItem>
            <DropdownMenuItem disabled={paymentDisabled} onClick={() => onMarkPaid(invoice)}>
              <CheckCircle2 className="size-4" />
              Mark as Paid
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onExport(invoice, "pdf")}>
          <Download className="size-4" />
          Export PDF
        </DropdownMenuItem>
        {canManage ? (
          <DropdownMenuItem onClick={() => onExport(invoice, "csv")}>
            <FileDown className="size-4" />
            Export CSV
          </DropdownMenuItem>
        ) : null}
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={invoice.paymentStatus === "PAID" || invoice.invoiceStatus === "CANCELLED"}
              onClick={() => onCancel(invoice)}
            >
              <Ban className="size-4" />
              Cancel Invoice
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GenerateInvoiceDialog({
  open,
  form,
  data,
  preview,
  filteredCarriers,
  isWorking,
  onOpenChange,
  onFormChange,
  onPreview,
  onGenerate,
}: {
  open: boolean;
  form: GenerateForm;
  data: InvoiceListBundle | null;
  preview: InvoicePreview | null;
  filteredCarriers: { id: string; name: string }[];
  isWorking: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: GenerateForm) => void;
  onPreview: () => void;
  onGenerate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-[#E2E8F0] p-6">
          <DialogTitle className="text-xl font-semibold text-[#0F172A]">Generate Invoice</DialogTitle>
          <DialogDescription>Create a payable or receivable invoice from approved activity.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Invoice type">
                <NativeSelect value={form.invoiceType} onChange={(invoiceType) => onFormChange({ ...form, invoiceType: invoiceType as InvoiceType })}>
                  {INVOICE_TYPES.map((type) => (
                    <option key={type} value={type}>{INVOICE_TYPE_LABELS[type]}</option>
                  ))}
                </NativeSelect>
              </Field>
              {form.invoiceType === INVOICE_DISPATCHER_PAYABLE ? (
                <Field label="Dispatcher">
                  <NativeSelect value={form.dispatcherId} onChange={(dispatcherId) => onFormChange({ ...form, dispatcherId })}>
                    <option value="">Select dispatcher</option>
                    {data?.filterOptions.dispatchers.map((dispatcher) => (
                      <option key={dispatcher.id} value={dispatcher.id}>{dispatcher.name}</option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : (
                <Field label="Carrier">
                  <NativeSelect value={form.carrierId} onChange={(carrierId) => onFormChange({ ...form, carrierId })}>
                    <option value="">Select carrier</option>
                    {filteredCarriers.map((carrier) => (
                      <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field label="Period start"><ToolbarInput type="date" value={form.periodStart} onChange={(event) => onFormChange({ ...form, periodStart: event.target.value })} /></Field>
              <Field label="Period end"><ToolbarInput type="date" value={form.periodEnd} onChange={(event) => onFormChange({ ...form, periodEnd: event.target.value })} /></Field>
              <Field label="Issue date"><ToolbarInput type="date" value={form.issueDate} onChange={(event) => onFormChange({ ...form, issueDate: event.target.value })} /></Field>
              <Field label="Due date"><ToolbarInput type="date" value={form.dueDate} onChange={(event) => onFormChange({ ...form, dueDate: event.target.value })} /></Field>
              <Field label="Notes">
                <Input className="h-10 rounded-lg border-[#E2E8F0]" value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
              </Field>
            </div>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-[#0F172A]">Preview</h3>
              <Button variant="outline" size="sm" onClick={onPreview} disabled={isWorking}>
                Refresh
              </Button>
            </div>
            {preview ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewMetric label="Activities" value={preview.activityCount} />
                <PreviewMetric label="Delivered" value={preview.deliveredLoads} />
                <PreviewMetric label="Cancelled" value={preview.cancelledLoads} />
                <PreviewMetric label="Load Amount" value={compactMoney(preview.totalLoadAmount)} />
                <PreviewMetric label="Dispatch Fee" value={compactMoney(preview.totalDispatchFee)} />
                <PreviewMetric label="Expected Amount" value={compactMoney(preview.expectedInvoiceAmount)} highlight />
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-white text-center text-sm text-[#64748B]">
                <ReceiptText className="mb-3 size-8 text-[#2563EB]" />
                Preview activities before generating.
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="rounded-b-2xl border-t bg-[#F8FAFC]">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>Cancel</Button>
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]" onClick={onGenerate} disabled={isWorking}>Generate Invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  invoice,
  form,
  isWorking,
  onOpenChange,
  onFormChange,
  onSubmit,
}: {
  open: boolean;
  invoice: InvoiceListItem | null;
  form: PaymentForm;
  isWorking: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: PaymentForm) => void;
  onSubmit: () => void;
}) {
  const amount = Number(form.paymentAmount || 0);
  const newPending = Math.max((invoice?.pendingAmount ?? 0) - amount, 0);
  const isInvalid = amount <= 0 || amount > (invoice?.pendingAmount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#E2E8F0] p-6">
          <DialogTitle className="text-xl font-semibold text-[#0F172A]">Record Payment</DialogTitle>
          <DialogDescription>Record a payment and update invoice status.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 p-6 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="mb-4 font-semibold text-[#0F172A]">Invoice Summary</h3>
            <div className="space-y-3 text-sm">
              <DetailLine label="Invoice ID" value={invoice?.invoiceNumber ?? "-"} />
              <DetailLine label="Total amount" value={formatCurrency(invoice?.totalAmount ?? 0)} />
              <DetailLine label="Already paid" value={formatCurrency(invoice?.paidAmount ?? 0)} />
              <DetailLine label="Pending" value={formatCurrency(invoice?.pendingAmount ?? 0)} />
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-[#64748B]">New pending after payment</p>
                <p className="mt-1 text-lg font-semibold text-[#0F172A]">{formatCurrency(newPending)}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            <Field label="Payment amount">
              <Input
                className="h-10 rounded-lg border-[#E2E8F0]"
                type="number"
                min="0.01"
                step="0.01"
                value={form.paymentAmount}
                onChange={(event) => onFormChange({ ...form, paymentAmount: event.target.value })}
              />
              {isInvalid && form.paymentAmount ? (
                <p className="text-xs text-red-600">Amount must be greater than 0 and no more than pending.</p>
              ) : null}
            </Field>
            <Field label="Payment date"><ToolbarInput type="date" value={form.paymentDate} onChange={(event) => onFormChange({ ...form, paymentDate: event.target.value })} /></Field>
            <Field label="Payment method">
              <NativeSelect value={form.paymentMethod} onChange={(paymentMethod) => onFormChange({ ...form, paymentMethod: paymentMethod as InvoicePaymentMethod })}>
                {INVOICE_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>{INVOICE_PAYMENT_METHOD_LABELS[method]}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Payment reference"><Input className="h-10 rounded-lg border-[#E2E8F0]" value={form.paymentReference} onChange={(event) => onFormChange({ ...form, paymentReference: event.target.value })} /></Field>
            <Field label="Notes"><Input className="h-10 rounded-lg border-[#E2E8F0]" value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} /></Field>
          </div>
        </div>
        <DialogFooter className="rounded-b-2xl border-t bg-[#F8FAFC]">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>Cancel</Button>
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]" onClick={onSubmit} disabled={isWorking || isInvalid}>Record Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDetailDialog({
  open,
  invoice,
  isWorking,
  onOpenChange,
  onExportPdf,
}: {
  open: boolean;
  invoice: InvoiceDetail | null;
  isWorking: boolean;
  onOpenChange: (open: boolean) => void;
  onExportPdf: (invoice: InvoiceDetail) => void;
}) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl bg-[#F8FAFC] p-0 sm:max-w-6xl">
        <div className="border-b border-[#E2E8F0] bg-white p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
                <ReceiptText className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-semibold text-[#0F172A]">{invoice.invoiceNumber}</DialogTitle>
                <DialogDescription className="mt-1">
                  Issued {dateLabel(invoice.issueDate)} · Due {dateLabel(invoice.dueDate)}
                </DialogDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge kind="type" status={invoice.invoiceType} />
                  <StatusBadge kind="invoice" status={invoice.invoiceStatus} />
                  <StatusBadge kind="payment" status={invoice.paymentStatus} />
                </div>
              </div>
            </div>
            <Button variant="outline" disabled={isWorking} onClick={() => onExportPdf(invoice)}>
              <Download className="size-4" />
              Download PDF
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <SectionCard title="Entity Details">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <DetailLine label="Name" value={invoice.entityName} />
                <DetailLine label="Team" value={invoice.entity.teamName ?? invoice.teamName ?? "-"} />
                <DetailLine label="Dispatcher" value={invoice.entity.dispatcherName ?? invoice.dispatcherName ?? "-"} />
                <DetailLine label="Email" value={invoice.entity.dispatcherEmail ?? "-"} />
                <DetailLine label="Phone" value={invoice.entity.dispatcherPhone ?? "-"} />
                <DetailLine label="Carrier" value={invoice.entity.carrierName ?? invoice.carrierName ?? "-"} />
                <DetailLine label="Driver" value={invoice.entity.driverName ?? "-"} />
                <DetailLine label="MC / Truck" value={`${invoice.entity.mcNumber ?? "-"} / ${invoice.entity.truckType?.replaceAll("_", " ") ?? "-"}`} />
              </div>
            </SectionCard>
            <SectionCard title="Financial Summary">
              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryTile label="Total amount" value={formatCurrency(invoice.totalAmount)} tone="blue" />
                <SummaryTile label="Paid amount" value={formatCurrency(invoice.paidAmount)} tone="green" />
                <SummaryTile label="Pending" value={formatCurrency(invoice.pendingAmount)} tone="amber" />
                <SummaryTile label="Delivered" value={String(invoice.summary.totalDeliveredLoads)} tone="violet" />
                <SummaryTile label="Cancelled" value={String(invoice.summary.totalCancelledLoads)} tone="red" />
                <SummaryTile label="Total miles" value={invoice.summary.totalMiles.toLocaleString()} tone="teal" />
                <SummaryTile label="Average RPM" value={formatRatePerMile(invoice.summary.averageRatePerMile, "-")} tone="blue" />
                <SummaryTile label="Dispatch fee" value={formatCurrency(invoice.summary.totalDispatchFee)} tone="green" />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Activity Items" flush>
            <div className="overflow-x-auto">
              <Table className="min-w-[1040px]">
                <TableHeader className="bg-[#F8FAFC]">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Dispatcher</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Miles</TableHead>
                    <TableHead>Load Amount</TableHead>
                    <TableHead>Dispatch Fee</TableHead>
                    <TableHead>Item Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{dateLabel(item.activityDate)}</TableCell>
                      <TableCell>{item.status.replaceAll("_", " ")}</TableCell>
                      <TableCell>{item.carrierName}</TableCell>
                      <TableCell>{item.dispatcherName}</TableCell>
                      <TableCell>{item.origin ?? "-"}</TableCell>
                      <TableCell>{item.destination ?? "-"}</TableCell>
                      <TableCell>{item.totalMiles?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>{item.loadAmount != null ? formatCurrency(item.loadAmount) : "-"}</TableCell>
                      <TableCell>{item.dispatchFee != null ? formatCurrency(item.dispatchFee) : "-"}</TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title="Payment History" flush>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#F8FAFC]">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.length > 0 ? invoice.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{dateLabel(payment.paymentDate)}</TableCell>
                      <TableCell className="font-semibold text-[#14B8A6]">{formatCurrency(payment.paymentAmount)}</TableCell>
                      <TableCell>{payment.paymentMethod.replaceAll("_", " ")}</TableCell>
                      <TableCell>{payment.paymentReference ?? "-"}</TableCell>
                      <TableCell>{payment.recordedByName ?? "-"}</TableCell>
                      <TableCell>{payment.notes ?? "-"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6}>No payments recorded.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <p className="text-sm text-[#64748B]">
            Notes: {invoice.notes ?? "-"} · Generated by {invoice.generatedByName ?? "-"} · Generated {dateLabel(invoice.createdAt.slice(0, 10))}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({
  title,
  children,
  flush,
}: {
  title: string;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <Card className="rounded-xl border border-[#E2E8F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader className="border-b border-[#E2E8F0] px-5 py-4">
        <CardTitle className="text-base font-semibold text-[#0F172A]">{title}</CardTitle>
      </CardHeader>
      <CardContent className={flush ? "p-0" : "p-5"}>{children}</CardContent>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "violet" | "teal" | "red";
}) {
  const color = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    violet: "text-violet-600",
    teal: "text-teal-600",
    red: "text-red-600",
  }[tone];

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className={cn("mt-1 font-semibold", color)}>{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-[#475569]">{label}</Label>
      {children}
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-[#E2E8F0] bg-white p-3", highlight && "border-[#2563EB]/30 bg-blue-50")}>
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className={cn("mt-1 font-semibold text-[#0F172A]", highlight && "text-[#2563EB]")}>{value}</p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-white/60 p-2">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-right font-medium text-[#0F172A]">{value}</span>
    </div>
  );
}
