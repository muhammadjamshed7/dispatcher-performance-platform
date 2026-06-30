import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants/invoices";
import type { InvoiceDashboardBundle, InvoiceListItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import {
  BORDER_COLOR,
  DARK_NAVY,
  LIGHT_BLUE_BG,
  LIGHT_GRAY_ROW,
  MUTED_COLOR,
  PAGE_MARGIN,
  PRIMARY_BLUE,
  TABLE_NAVY,
  TEXT_COLOR,
  drawFooterOnAllPages,
  drawReportHeader,
  drawSectionHeading,
  formatGeneratedAtLabel,
  loadLogo,
  type JsPdfDocument,
  type RGB,
} from "@/lib/reports/pdf-theme";

type InvoiceListPdfInput = {
  invoices: InvoiceListItem[];
  dashboard: InvoiceDashboardBundle;
  title?: string;
  filterLabel?: string;
};

function dateCell(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function periodCell(invoice: InvoiceListItem): string {
  return `${dateCell(invoice.periodStart)} - ${dateCell(invoice.periodEnd)}`;
}

function fileDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function metricRows(dashboard: InvoiceDashboardBundle): string[][] {
  const { metrics } = dashboard;
  return [
    ["Total Invoices", metrics.totalInvoices.toLocaleString()],
    ["Total Invoice Amount", formatCurrency(metrics.totalInvoiceAmount)],
    ["Paid Invoices", metrics.paidInvoices.toLocaleString()],
    ["Paid Amount", formatCurrency(metrics.paidAmount)],
    ["Pending Amount", formatCurrency(metrics.dispatcherPendingAmount + metrics.carrierPendingAmount)],
    ["Overdue Amount", formatCurrency(metrics.overdueAmount)],
    ["Dispatcher Payables", formatCurrency(metrics.dispatcherPendingAmount)],
    ["Carrier Receivables", formatCurrency(metrics.carrierPendingAmount)],
  ];
}

export async function exportInvoiceListPdf({
  invoices,
  dashboard,
  title = "INVOICE REGISTER",
  filterLabel = "Current filters",
}: InvoiceListPdfInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  }) as unknown as JsPdfDocument;

  const logo = await loadLogo();
  let y = drawReportHeader(doc, {
    title,
    accentLine: "Dispatcher Performance Platform",
    metaLines: [
      `Generated: ${formatGeneratedAtLabel()}`,
      `Invoices exported: ${invoices.length.toLocaleString()}`,
      filterLabel,
    ],
    logo,
    accentBarHeight: 30,
  });

  y = drawSectionHeading(doc, "PORTFOLIO SUMMARY", "bars", y);

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: metricRows(dashboard).reduce<string[][]>((rows, row, index, source) => {
      if (index % 2 === 0) {
        const next = source[index + 1] ?? ["", ""];
        rows.push([row[0] ?? "", row[1] ?? "", next[0] ?? "", next[1] ?? ""]);
      }
      return rows;
    }, []),
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: TABLE_NAVY,
      textColor: [255, 255, 255] as RGB,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY_ROW },
    columnStyles: {
      1: { halign: "right", fontStyle: "bold" },
      3: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  doc.setFillColor(...LIGHT_BLUE_BG);
  doc.roundedRect(PAGE_MARGIN, y, 251, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_NAVY);
  doc.text("Invoice Export", PAGE_MARGIN + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_COLOR);
  doc.text(
    "A downloadable register of dispatcher payables and carrier receivables with current status, payment totals, and due dates.",
    PAGE_MARGIN + 4,
    y + 11,
  );
  doc.setTextColor(0, 0, 0);

  y += 24;
  y = drawSectionHeading(doc, `INVOICES (${invoices.length.toLocaleString()})`, "clipboard", y);

  autoTable(doc, {
    startY: y,
    head: [[
      "Invoice ID",
      "Type",
      "Entity",
      "Team",
      "Period",
      "Due Date",
      "Total",
      "Paid",
      "Pending",
      "Status",
      "Payment",
    ]],
    body:
      invoices.length > 0
        ? invoices.map((invoice) => [
            invoice.invoiceNumber,
            INVOICE_TYPE_LABELS[invoice.invoiceType],
            invoice.entityName,
            invoice.teamName ?? "",
            periodCell(invoice),
            dateCell(invoice.dueDate),
            formatCurrency(invoice.totalAmount),
            formatCurrency(invoice.paidAmount),
            formatCurrency(invoice.pendingAmount),
            INVOICE_STATUS_LABELS[invoice.invoiceStatus],
            PAYMENT_STATUS_LABELS[invoice.paymentStatus],
          ])
        : [["", "No invoices found", "", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.7,
      overflow: "linebreak",
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: TABLE_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.7,
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY_ROW },
    columnStyles: {
      0: { cellWidth: 27, textColor: PRIMARY_BLUE, fontStyle: "bold" },
      1: { cellWidth: 25 },
      2: { cellWidth: 32 },
      3: { cellWidth: 25 },
      4: { cellWidth: 32 },
      5: { cellWidth: 22 },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 20, halign: "right" },
      8: { cellWidth: 20, halign: "right" },
      9: { cellWidth: 20 },
      10: { cellWidth: 20 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: 18, bottom: 18 },
  });

  drawFooterOnAllPages(doc);
  doc.save(`invoice-register-${fileDateKey()}.pdf`);
}
