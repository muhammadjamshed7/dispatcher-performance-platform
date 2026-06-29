import { APPROVED, REJECTED } from "@/lib/constants/activity-approval";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import type { ActivityApprovalStatus } from "@/lib/constants/activity-approval";
import type { Carrier, DailyActivity } from "@/lib/types";
import { computeAverageRatePerMile } from "@/lib/utils/compute-finance-metrics";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatActivityDate } from "@/lib/utils/format-date";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

import {
  AMBER_BADGE,
  APPROVAL_BADGE_BY_LABEL,
  BORDER_COLOR,
  DASH,
  GRAY_BADGE,
  GREEN_BADGE,
  LIGHT_GRAY_ROW,
  MUTED_COLOR,
  PAGE_MARGIN,
  RED_BADGE,
  STATUS_BADGE_BY_LABEL,
  TABLE_NAVY,
  TEXT_COLOR,
  drawBadge,
  drawFooter,
  drawReportHeader,
  drawSectionHeading,
  formatGeneratedAtLabel,
  formatMiles,
  loadLogo,
  nullableText,
  slugify,
  type JsPdfDocument,
  type RGB,
} from "./pdf-theme";

export type CarrierActivityPdfExportInput = {
  carrier: Carrier;
  activities: DailyActivity[];
};

const HISTORY_TABLE_HEAD = [
  "Date",
  "Status",
  "Approval",
  "Origin",
  "Destination",
  "Miles",
  "Load Amt",
  "Rate/Mi",
  "Disp Fee",
  "Reason",
  "Notes",
];

function currentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function currentMonthLabel(): string {
  return new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function approvalShortLabel(status: ActivityApprovalStatus): string {
  if (status === APPROVED) return "Approved";
  if (status === REJECTED) return "Rejected";
  return "Pending";
}

type MonthlySummary = {
  totalActivities: number;
  deliveredLoads: number;
  cancelledLoads: number;
  notBookedLoads: number;
  notWorkingLoads: number;
  totalRevenue: number;
  totalDispatchFee: number;
  averageRatePerMile: number | null;
  totalMiles: number;
};

function computeMonthlySummary(activities: DailyActivity[]): MonthlySummary {
  const delivered = activities.filter((row) => row.status === DELIVERED);

  return {
    totalActivities: activities.length,
    deliveredLoads: delivered.length,
    cancelledLoads: activities.filter((row) => row.status === CANCELLED).length,
    notBookedLoads: activities.filter((row) => row.status === NOT_BOOKED)
      .length,
    notWorkingLoads: activities.filter((row) => row.status === NOT_WORKING)
      .length,
    totalRevenue: delivered.reduce(
      (sum, row) => sum + (row.loadAmount ?? 0),
      0,
    ),
    totalDispatchFee: delivered.reduce(
      (sum, row) => sum + (row.dispatchFee ?? 0),
      0,
    ),
    averageRatePerMile: computeAverageRatePerMile(
      activities.map((row) => ({
        status: row.status,
        loadAmount: row.loadAmount,
        miles: row.miles,
      })),
    ),
    totalMiles: activities.reduce((sum, row) => sum + (row.miles ?? 0), 0),
  };
}

function activityToHistoryRow(activity: DailyActivity): string[] {
  const isDelivered = activity.status === DELIVERED;

  return [
    formatActivityDate(activity.date),
    getLoadActivityStatusLabel(activity.status),
    approvalShortLabel(activity.approvalStatus),
    nullableText(activity.origin),
    nullableText(activity.destination),
    activity.miles != null ? formatMiles(activity.miles) : DASH,
    isDelivered && activity.loadAmount != null
      ? formatCurrency(activity.loadAmount, { nullLabel: DASH })
      : DASH,
    isDelivered ? formatRatePerMile(activity.ratePerMile, DASH) : DASH,
    isDelivered
      ? formatCurrency(activity.dispatchFee, { nullLabel: DASH })
      : DASH,
    nullableText(activity.reason),
    nullableText(activity.notes),
  ];
}

function buildReportFilename(carrier: Carrier, monthLabel: string): string {
  return `carrier-${slugify(carrier.carrierName, "carrier")}-activity-report-${slugify(
    monthLabel,
    "carrier",
  )}.pdf`;
}

export async function exportCarrierActivityPdf({
  carrier,
  activities,
}: CarrierActivityPdfExportInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as unknown as JsPdfDocument;

  const logo = await loadLogo();

  const monthKey = currentMonthKey();
  const monthLabel = currentMonthLabel();
  const monthActivities = activities.filter(
    (activity) => (activity.date ?? "").slice(0, 7) === monthKey,
  );
  const summary = computeMonthlySummary(monthActivities);

  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;

  let y = drawReportHeader(doc, {
    title: "CARRIER ACTIVITY REPORT",
    accentLine: carrier.carrierName,
    metaLines: [
      `Generated: ${formatGeneratedAtLabel()}`,
      `Total activities on record: ${activities.length}`,
    ],
    logo,
  });

  // ---- Section 1: Carrier Details ----
  y = drawSectionHeading(doc, "CARRIER DETAILS", "person", y);

  const labelCellStyle = {
    cellWidth: 34,
    fontStyle: "bold" as const,
    fillColor: LIGHT_GRAY_ROW,
    textColor: TEXT_COLOR,
  };

  autoTable(doc, {
    startY: y,
    body: [
      [
        "Carrier Name",
        carrier.carrierName,
        "Assigned Team",
        carrier.assignedTeamName || DASH,
      ],
      [
        "Driver Name",
        carrier.driverName,
        "Assigned Dispatcher",
        carrier.assignedDispatcherName || DASH,
      ],
      [
        "MC Number",
        carrier.mcNumber,
        "Dispatch Fee %",
        `${carrier.dispatchFeePercentage}%`,
      ],
      [
        "Truck Type",
        carrier.truckType.replaceAll("_", " "),
        "Status",
        carrier.status,
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2.6,
      valign: "middle",
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: labelCellStyle,
      1: { cellWidth: 57 },
      2: labelCellStyle,
      3: { cellWidth: 57 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.column.index === 3 &&
        data.row.index === 3
      ) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (
        data.section === "body" &&
        data.column.index === 3 &&
        data.row.index === 3
      ) {
        const raw = String(carrier.status).toUpperCase();
        const palette = raw === "ACTIVE" ? GREEN_BADGE : RED_BADGE;
        drawBadge(
          doc,
          data.cell.x + data.cell.width / 2,
          data.cell.y + data.cell.height / 2,
          raw,
          palette,
          8,
        );
      }
    },
    didDrawPage: () => drawFooter(doc),
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 9;

  // ---- Section 2: Monthly Performance Summary ----
  y = drawSectionHeading(
    doc,
    `MONTHLY PERFORMANCE SUMMARY — ${monthLabel.toUpperCase()}`,
    "bars",
    y,
  );

  const summaryGap = 6;
  const summaryHalf = (usableWidth - summaryGap) / 2;
  const summaryStartY = y;

  const summarySharedStyles = {
    theme: "grid" as const,
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
      fontStyle: "bold" as const,
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY_ROW },
  };

  autoTable(doc, {
    startY: summaryStartY,
    head: [["Metric", "Value"]],
    body: [
      ["Total Activities", String(summary.totalActivities)],
      ["Total Delivered Loads", String(summary.deliveredLoads)],
      ["Total Cancelled Loads", String(summary.cancelledLoads)],
      ["Total Not Booked Loads", String(summary.notBookedLoads)],
      ["Total Not Working Entries", String(summary.notWorkingLoads)],
    ],
    ...summarySharedStyles,
    columnStyles: {
      0: { cellWidth: summaryHalf - 26 },
      1: { cellWidth: 26, halign: "right" },
    },
    tableWidth: summaryHalf,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didDrawPage: () => drawFooter(doc),
  });
  const leftFinalY = doc.lastAutoTable?.finalY ?? summaryStartY;

  autoTable(doc, {
    startY: summaryStartY,
    head: [["Metric", "Value"]],
    body: [
      [
        "Total Revenue (Load Amount)",
        formatCurrency(summary.totalRevenue, { nullLabel: "$0.00" }),
      ],
      [
        "Total Dispatch Fee",
        formatCurrency(summary.totalDispatchFee, { nullLabel: "$0.00" }),
      ],
      [
        "Average Rate Per Mile",
        formatRatePerMile(summary.averageRatePerMile, DASH),
      ],
      ["Total Miles Covered", formatMiles(summary.totalMiles)],
    ],
    ...summarySharedStyles,
    columnStyles: {
      0: { cellWidth: summaryHalf - 32 },
      1: { cellWidth: 32, halign: "right" },
    },
    tableWidth: summaryHalf,
    margin: {
      left: PAGE_MARGIN + summaryHalf + summaryGap,
      right: PAGE_MARGIN,
    },
  });
  const rightFinalY = doc.lastAutoTable?.finalY ?? summaryStartY;

  y = Math.max(leftFinalY, rightFinalY) + 9;

  // ---- Section 3: Activity History ----
  y = drawSectionHeading(
    doc,
    `ACTIVITY HISTORY (${activities.length} RECORDS)`,
    "clipboard",
    y,
  );

  if (activities.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("No activity history available.", PAGE_MARGIN, y + 2);
    doc.setTextColor(0, 0, 0);
    doc.save(buildReportFilename(carrier, monthLabel));
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [HISTORY_TABLE_HEAD],
    body: activities.map((activity) => activityToHistoryRow(activity)),
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      overflow: "linebreak",
      valign: "middle",
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: TABLE_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 7.2,
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY_ROW },
    columnStyles: {
      0: { cellWidth: 17 },
      1: { cellWidth: 19, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 11, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 15, halign: "right" },
      9: { cellWidth: 16 },
      10: { cellWidth: 16 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: 18, bottom: 18 },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        (data.column.index === 1 || data.column.index === 2)
      ) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") {
        return;
      }

      const centerX = data.cell.x + data.cell.width / 2;
      const centerY = data.cell.y + data.cell.height / 2;

      if (data.column.index === 1) {
        const label = String(data.cell.raw ?? "");
        const palette = STATUS_BADGE_BY_LABEL[label] ?? GRAY_BADGE;
        drawBadge(doc, centerX, centerY, label, palette, 6.5);
      } else if (data.column.index === 2) {
        const label = String(data.cell.raw ?? "");
        const palette = APPROVAL_BADGE_BY_LABEL[label] ?? AMBER_BADGE;
        drawBadge(doc, centerX, centerY, label, palette, 6.5);
      }
    },
    didDrawPage: () => drawFooter(doc),
  });

  doc.save(buildReportFilename(carrier, monthLabel));
}
