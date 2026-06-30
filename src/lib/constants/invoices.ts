export const INVOICE_DISPATCHER_PAYABLE = "DISPATCHER_PAYABLE" as const;
export const INVOICE_CARRIER_RECEIVABLE = "CARRIER_RECEIVABLE" as const;

export const INVOICE_TYPES = [
  INVOICE_DISPATCHER_PAYABLE,
  INVOICE_CARRIER_RECEIVABLE,
] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  DISPATCHER_PAYABLE: "Dispatcher Payable",
  CARRIER_RECEIVABLE: "Carrier Receivable",
};

export const INVOICE_DRAFT = "DRAFT" as const;
export const INVOICE_ISSUED = "ISSUED" as const;
export const INVOICE_PARTIALLY_PAID = "PARTIALLY_PAID" as const;
export const INVOICE_PAID = "PAID" as const;
export const INVOICE_OVERDUE = "OVERDUE" as const;
export const INVOICE_CANCELLED = "CANCELLED" as const;

export const INVOICE_STATUSES = [
  INVOICE_DRAFT,
  INVOICE_ISSUED,
  INVOICE_PARTIALLY_PAID,
  INVOICE_PAID,
  INVOICE_OVERDUE,
  INVOICE_CANCELLED,
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const PAYMENT_UNPAID = "UNPAID" as const;
export const PAYMENT_PARTIALLY_PAID = "PARTIALLY_PAID" as const;
export const PAYMENT_PAID = "PAID" as const;

export const PAYMENT_STATUSES = [
  PAYMENT_UNPAID,
  PAYMENT_PARTIALLY_PAID,
  PAYMENT_PAID,
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
};

export const INVOICE_PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "CHECK",
  "OTHER",
] as const;

export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];

export const INVOICE_PAYMENT_METHOD_LABELS: Record<
  InvoicePaymentMethod,
  string
> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card",
  CHECK: "Check",
  OTHER: "Other",
};
