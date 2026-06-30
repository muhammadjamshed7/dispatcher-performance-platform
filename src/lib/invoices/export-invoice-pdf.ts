import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants/invoices";
import type { InvoiceDetail } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import {
  BORDER_COLOR,
  DASH,
  GREEN_BADGE,
  GRAY_BADGE,
  LIGHT_GRAY_ROW,
  PAGE_MARGIN,
  RED_BADGE,
  TABLE_NAVY,
  TEXT_COLOR,
  drawFooterOnAllPages,
  drawReportHeader,
  drawSectionHeading,
  formatGeneratedAtLabel,
  loadLogo,
  type BadgePalette,
  type JsPdfDocument,
  type RGB,
} from "@/lib/reports/pdf-theme";

function badgePalette(label: string): BadgePalette {
  if (label.includes("Paid")) return GREEN_BADGE;
  if (label.includes("Overdue")) return RED_BADGE;
  if (label.includes("Cancelled")) return GRAY_BADGE;
  return {
    text: [37, 99, 235],
    bg: [219, 234, 254],
    border: [147, 197, 253],
  };
}

function dateCell(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function text(value: string | null | undefined): string {
  return value?.trim() ? value : DASH;
}

export async function exportInvoicePdf(invoice: InvoiceDetail): Promise<void> {
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;

  let y = drawReportHeader(doc, {
    title: "INVOICE",
    accentLine: invoice.invoiceNumber,
    metaLines: [
      INVOICE_TYPE_LABELS[invoice.invoiceType],
      `Generated: ${formatGeneratedAtLabel()}`,
      `Period: ${dateCell(invoice.periodStart)} - ${dateCell(invoice.periodEnd)}`,
    ],
    logo,
    accentBarHeight: 28,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...badgePalette(invoice.invoiceStatus).text);
  doc.text(INVOICE_STATUS_LABELS[invoice.invoiceStatus], pageWidth - 86, y - 2);
  doc.setTextColor(...badgePalette(invoice.paymentStatus).text);
  doc.text(PAYMENT_STATUS_LABELS[invoice.paymentStatus], pageWidth - 44, y - 2);
  doc.setTextColor(0, 0, 0);

  y = drawSectionHeading(doc, "ENTITY DETAILS", "person", y);
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value", "Field", "Value"]],
    body: [
      [
        "Entity",
        invoice.entityName,
        "Team",
        text(invoice.entity.teamName ?? invoice.teamName),
      ],
      [
        "Dispatcher",
        text(invoice.entity.dispatcherName ?? invoice.dispatcherName),
        "Email",
        text(invoice.entity.dispatcherEmail),
      ],
      [
        "Carrier",
        text(invoice.entity.carrierName ?? invoice.carrierName),
        "Driver / MC",
        `${text(invoice.entity.driverName)} / ${text(invoice.entity.mcNumber)}`,
      ],
      ["Issue Date", dateCell(invoice.issueDate), "Due Date", dateCell(invoice.dueDate)],
    ],
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
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
    tableWidth: usableWidth,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  y = drawSectionHeading(doc, "FINANCIAL SUMMARY", "bars", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Delivered Loads", invoice.summary.totalDeliveredLoads, "Cancelled Loads", invoice.summary.totalCancelledLoads],
      ["Not Booked", invoice.summary.totalNotBooked, "Not Working", invoice.summary.totalNotWorking],
      ["Total Revenue", formatCurrency(invoice.summary.totalRevenue), "Dispatch Fee", formatCurrency(invoice.summary.totalDispatchFee)],
      ["Total Amount", formatCurrency(invoice.totalAmount), "Paid", formatCurrency(invoice.paidAmount)],
      ["Pending", formatCurrency(invoice.pendingAmount), "Avg Rate/Mile", formatRatePerMile(invoice.summary.averageRatePerMile, DASH)],
    ],
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
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
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  y = drawSectionHeading(doc, `ACTIVITY ITEMS (${invoice.items.length})`, "clipboard", y);
  autoTable(doc, {
    startY: y,
    head: [[
      "Date",
      "Carrier",
      "Dispatcher",
      "Status",
      "Origin",
      "Destination",
      "Miles",
      "Load",
      "Rate/Mi",
      "Disp Fee",
      "Amount",
      "Notes",
    ]],
    body: invoice.items.map((item) => [
      dateCell(item.activityDate),
      item.carrierName,
      item.dispatcherName,
      item.status.replaceAll("_", " "),
      text(item.origin),
      text(item.destination),
      item.totalMiles?.toLocaleString() ?? DASH,
      item.loadAmount != null ? formatCurrency(item.loadAmount) : DASH,
      formatRatePerMile(item.ratePerMile, DASH),
      item.dispatchFee != null ? formatCurrency(item.dispatchFee) : DASH,
      formatCurrency(item.amount),
      text(item.itemDescription),
    ]),
    theme: "grid",
    styles: {
      fontSize: 7.2,
      cellPadding: 1.6,
      overflow: "linebreak",
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: TABLE_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY_ROW },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: 18, bottom: 18 },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  if (y > 175) {
    doc.addPage();
    y = 18;
  }
  y = drawSectionHeading(doc, "PAYMENT HISTORY", "clock", y);
  autoTable(doc, {
    startY: y,
    head: [["Date", "Amount", "Method", "Reference", "Recorded By", "Notes"]],
    body:
      invoice.payments.length > 0
        ? invoice.payments.map((payment) => [
            dateCell(payment.paymentDate),
            formatCurrency(payment.paymentAmount),
            payment.paymentMethod.replaceAll("_", " "),
            text(payment.paymentReference),
            text(payment.recordedByName),
            text(payment.notes),
          ])
        : [["", "No payments recorded", "", "", "", ""]],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: TABLE_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Notes: ${text(invoice.notes)}`, PAGE_MARGIN, y);
  doc.text(
    `Generated by: ${text(invoice.generatedByName)} | Payment status: ${PAYMENT_STATUS_LABELS[invoice.paymentStatus]}`,
    PAGE_MARGIN,
    y + 5,
  );

  drawFooterOnAllPages(doc);
  doc.save(`${invoice.invoiceNumber.toLowerCase()}.pdf`);
}
