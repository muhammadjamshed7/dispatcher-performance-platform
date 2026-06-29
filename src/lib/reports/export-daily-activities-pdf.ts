import {
  ACTIVITY_APPROVAL_LABELS,
  APPROVED,
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
  REJECTED,
} from "@/lib/constants/activity-approval";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import type { DailyActivity } from "@/lib/types";
import { formatActivityDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

import {
  buildActivitiesReportFilterLines,
  type ActivitiesReportFilterContext,
} from "./activities-report-filter-labels";
import {
  calculateActivityFinancialTotals,
  groupActivitiesByCarrier,
  groupActivitiesByDispatcher,
  type ActivityFinancialTotals,
} from "./activities-report-metrics";
import {
  AMBER_BADGE,
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
  drawFooterOnAllPages,
  drawReportHeader,
  drawSectionHeading,
  formatGeneratedAtLabel,
  formatMiles,
  loadLogo,
  type BadgePalette,
  type JsPdfDocument,
  type RGB,
} from "./pdf-theme";

export type DailyActivitiesPdfExportInput = {
  activities: DailyActivity[];
  filterContext: ActivitiesReportFilterContext;
  /**
   * Adds an "Approval" column and folds rejection feedback into the notes cell.
   * Used for the dispatcher's own activity export where pending/rejected rows
   * are included.
   */
  includeApprovalDetails?: boolean;
};

const BASE_ACTIVITY_TABLE_HEAD = [
  "Date",
  "Carrier",
  "Dispatcher",
  "Team",
  "Truck",
  "Status",
  "Origin",
  "Destination",
  "Miles",
  "Load Amt",
  "Rate/Mi",
  "Disp Fee",
  "Reason",
  "Notes",
];

function buildActivityTableHead(includeApprovalDetails: boolean): string[] {
  if (!includeApprovalDetails) {
    return BASE_ACTIVITY_TABLE_HEAD;
  }

  // Insert the "Approval" column immediately after "Status".
  return [
    ...BASE_ACTIVITY_TABLE_HEAD.slice(0, 6),
    "Approval",
    ...BASE_ACTIVITY_TABLE_HEAD.slice(6),
  ];
}

const SUMMARY_TABLE_HEAD = [
  "Name",
  "Activities",
  "Delivered",
  "Miles",
  "Load Amount",
  "Avg Rate/Mi",
  "Dispatch Fee",
];

type ActivitiesReportSummary = {
  totalActivities: number;
  delivered: number;
  cancelled: number;
  notBooked: number;
  notWorking: number;
  approved: number;
  rejected: number;
  pending: number;
  totalRevenue: number;
  totalDispatchFee: number;
  totalMiles: number;
};

function computeActivitiesReportSummary(
  activities: DailyActivity[],
): ActivitiesReportSummary {
  const delivered = activities.filter((row) => row.status === DELIVERED);

  return {
    totalActivities: activities.length,
    delivered: delivered.length,
    cancelled: activities.filter((row) => row.status === CANCELLED).length,
    notBooked: activities.filter((row) => row.status === NOT_BOOKED).length,
    notWorking: activities.filter((row) => row.status === NOT_WORKING).length,
    approved: activities.filter((row) => row.approvalStatus === APPROVED)
      .length,
    rejected: activities.filter((row) => row.approvalStatus === REJECTED)
      .length,
    pending: activities.filter(
      (row) =>
        row.approvalStatus === PENDING_TEAM_LEAD_APPROVAL ||
        row.approvalStatus === PENDING_ADMIN_APPROVAL,
    ).length,
    totalRevenue: delivered.reduce(
      (sum, row) => sum + (row.loadAmount ?? 0),
      0,
    ),
    totalDispatchFee: delivered.reduce(
      (sum, row) => sum + (row.dispatchFee ?? 0),
      0,
    ),
    totalMiles: activities.reduce((sum, row) => sum + (row.miles ?? 0), 0),
  };
}

function nullableCell(value: string | null | undefined): string {
  const text = value?.toString().trim();
  return text ? text : DASH;
}

function activityToPdfRow(
  activity: DailyActivity,
  includeApprovalDetails: boolean,
): string[] {
  const isDelivered = activity.status === DELIVERED;

  let notesCell = activity.notes ?? "";
  if (
    includeApprovalDetails &&
    activity.approvalStatus === REJECTED &&
    activity.rejectionReason
  ) {
    notesCell = `Rejected: ${activity.rejectionReason}${
      notesCell ? ` | ${notesCell}` : ""
    }`;
  }

  const row = [
    formatActivityDate(activity.date),
    nullableCell(activity.carrierName),
    nullableCell(activity.dispatcherName),
    nullableCell(activity.teamName),
    activity.truckType.replaceAll("_", " "),
    getLoadActivityStatusLabel(activity.status),
    nullableCell(activity.origin),
    nullableCell(activity.destination),
    activity.miles != null ? formatMiles(activity.miles) : DASH,
    isDelivered && activity.loadAmount != null
      ? formatCurrency(activity.loadAmount, { nullLabel: DASH })
      : DASH,
    isDelivered ? formatRatePerMile(activity.ratePerMile, DASH) : DASH,
    isDelivered
      ? formatCurrency(activity.dispatchFee, { nullLabel: DASH })
      : DASH,
    nullableCell(activity.reason),
    nullableCell(notesCell),
  ];

  if (includeApprovalDetails) {
    row.splice(6, 0, ACTIVITY_APPROVAL_LABELS[activity.approvalStatus]);
  }

  return row;
}

function approvalBadgeFromLabel(label: string): {
  text: string;
  palette: BadgePalette;
} {
  if (label === "Approved") return { text: "Approved", palette: GREEN_BADGE };
  if (label === "Rejected") return { text: "Rejected", palette: RED_BADGE };
  return { text: "Pending", palette: AMBER_BADGE };
}

function totalsToSummaryRow(
  label: string,
  totals: ActivityFinancialTotals,
): string[] {
  return [
    label,
    String(totals.activityCount),
    String(totals.deliveredCount),
    formatMiles(totals.totalMiles),
    formatCurrency(totals.totalLoadAmount, { nullLabel: "$0.00" }),
    formatRatePerMile(totals.averageRatePerMile, DASH),
    formatCurrency(totals.totalDispatchFee, { nullLabel: "$0.00" }),
  ];
}

function buildReportFilename(): string {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `activities-report-${dateKey}.pdf`;
}

function ensureSpace(
  doc: JsPdfDocument,
  currentY: number,
  requiredHeight: number,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (currentY + requiredHeight <= pageHeight - 18) {
    return currentY;
  }

  doc.addPage();
  return 18;
}

const SUMMARY_SHARED_STYLES = {
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

const BREAKDOWN_SHARED_STYLES = {
  theme: "grid" as const,
  styles: {
    fontSize: 8,
    cellPadding: 2,
    overflow: "linebreak" as const,
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

export async function exportDailyActivitiesPdf({
  activities,
  filterContext,
  includeApprovalDetails = false,
}: DailyActivitiesPdfExportInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Landscape: the activity history table carries up to 15 columns (Date,
  // Carrier, Dispatcher, Team, Truck, Status, [Approval], Origin, Destination,
  // Miles, Load Amt, Rate/Mi, Disp Fee, Reason, Notes). Portrait would force
  // cramped columns and aggressive wrapping, so landscape keeps it readable.
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  }) as unknown as JsPdfDocument;

  const logo = await loadLogo();

  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;

  const filterLines = buildActivitiesReportFilterLines(filterContext);
  const summary = computeActivitiesReportSummary(activities);
  const grandTotals = calculateActivityFinancialTotals(activities);
  const carrierSummaries = groupActivitiesByCarrier(activities);
  const dispatcherSummaries = groupActivitiesByDispatcher(activities);

  const metaLines = [
    `Generated: ${formatGeneratedAtLabel()}`,
    `Total activities exported: ${activities.length}`,
    ...filterLines,
  ];
  const lastMetaY = 28 + (metaLines.length - 1) * 4.5;

  let y = drawReportHeader(doc, {
    title: "ACTIVITIES REPORT",
    metaLines,
    logo,
    accentBarHeight: Math.max(18, lastMetaY - 13 + 1),
  });

  // ---- Section 1: Report Summary ----
  y = drawSectionHeading(doc, "REPORT SUMMARY", "bars", y);

  const summaryGap = 6;
  const summaryHalf = (usableWidth - summaryGap) / 2;
  const summaryStartY = y;

  autoTable(doc, {
    startY: summaryStartY,
    head: [["Metric", "Value"]],
    body: [
      ["Total Activities", String(summary.totalActivities)],
      ["Delivered", String(summary.delivered)],
      ["Cancelled", String(summary.cancelled)],
      ["Not Booked", String(summary.notBooked)],
      ["Not Working", String(summary.notWorking)],
    ],
    ...SUMMARY_SHARED_STYLES,
    columnStyles: {
      0: { cellWidth: summaryHalf - 30 },
      1: { cellWidth: 30, halign: "right" },
    },
    tableWidth: summaryHalf,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  const leftFinalY = doc.lastAutoTable?.finalY ?? summaryStartY;

  autoTable(doc, {
    startY: summaryStartY,
    head: [["Metric", "Value"]],
    body: [
      ["Approved", String(summary.approved)],
      ["Rejected", String(summary.rejected)],
      ["Pending", String(summary.pending)],
      [
        "Total Revenue",
        formatCurrency(summary.totalRevenue, { nullLabel: "$0.00" }),
      ],
      [
        "Total Dispatch Fee",
        formatCurrency(summary.totalDispatchFee, { nullLabel: "$0.00" }),
      ],
      ["Total Miles", formatMiles(summary.totalMiles)],
    ],
    ...SUMMARY_SHARED_STYLES,
    columnStyles: {
      0: { cellWidth: summaryHalf - 38 },
      1: { cellWidth: 38, halign: "right" },
    },
    tableWidth: summaryHalf,
    margin: {
      left: PAGE_MARGIN + summaryHalf + summaryGap,
      right: PAGE_MARGIN,
    },
  });
  const rightFinalY = doc.lastAutoTable?.finalY ?? summaryStartY;

  y = Math.max(leftFinalY, rightFinalY) + 10;

  // ---- Section 2: Activity History ----
  y = ensureSpace(doc, y, 24);
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
    doc.text(
      "No activities available for the current filters.",
      PAGE_MARGIN,
      y + 2,
    );
    doc.setTextColor(0, 0, 0);
    drawFooterOnAllPages(doc);
    doc.save(buildReportFilename());
    return;
  }

  // Status column is always index 5; Approval (when present) is index 6.
  const statusColumnIndex = 5;
  const approvalColumnIndex = includeApprovalDetails ? 6 : -1;

  const activityColumnStyles: Record<
    number,
    { cellWidth: number; halign?: "right" | "center" }
  > = includeApprovalDetails
    ? {
        0: { cellWidth: 14 },
        1: { cellWidth: 19 },
        2: { cellWidth: 19 },
        3: { cellWidth: 14 },
        4: { cellWidth: 12 },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 16 },
        8: { cellWidth: 16 },
        9: { cellWidth: 11, halign: "right" },
        10: { cellWidth: 15, halign: "right" },
        11: { cellWidth: 13, halign: "right" },
        12: { cellWidth: 14, halign: "right" },
        13: { cellWidth: 16 },
        14: { cellWidth: 18 },
      }
    : {
        0: { cellWidth: 15 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 16 },
        4: { cellWidth: 13 },
        5: { cellWidth: 19, halign: "center" },
        6: { cellWidth: 19 },
        7: { cellWidth: 19 },
        8: { cellWidth: 12, halign: "right" },
        9: { cellWidth: 16, halign: "right" },
        10: { cellWidth: 14, halign: "right" },
        11: { cellWidth: 15, halign: "right" },
        12: { cellWidth: 22 },
        13: { cellWidth: 27 },
      };

  autoTable(doc, {
    startY: y,
    head: [buildActivityTableHead(includeApprovalDetails)],
    body: activities.map((activity) =>
      activityToPdfRow(activity, includeApprovalDetails),
    ),
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
    columnStyles: activityColumnStyles,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: 18, bottom: 18 },
    didParseCell: (data) => {
      if (data.section !== "body") {
        return;
      }
      if (
        data.column.index === statusColumnIndex ||
        data.column.index === approvalColumnIndex
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

      if (data.column.index === statusColumnIndex) {
        const label = String(data.cell.raw ?? "");
        const palette = STATUS_BADGE_BY_LABEL[label] ?? GRAY_BADGE;
        drawBadge(doc, centerX, centerY, label, palette, 6.5);
      } else if (data.column.index === approvalColumnIndex) {
        const { text, palette } = approvalBadgeFromLabel(
          String(data.cell.raw ?? ""),
        );
        drawBadge(doc, centerX, centerY, text, palette, 6.5);
      }
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  // ---- Section 3: Totals by Carrier ----
  y = ensureSpace(doc, y, 28);
  y = drawSectionHeading(doc, "TOTALS BY CARRIER", "person", y);

  autoTable(doc, {
    startY: y,
    head: [SUMMARY_TABLE_HEAD],
    body: carrierSummaries.map((item) =>
      totalsToSummaryRow(item.carrierName, item.totals),
    ),
    ...BREAKDOWN_SHARED_STYLES,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  // ---- Section 4: Totals by Dispatcher ----
  y = ensureSpace(doc, y, 28);
  y = drawSectionHeading(doc, "TOTALS BY DISPATCHER", "person", y);

  autoTable(doc, {
    startY: y,
    head: [["Dispatcher", "Team", ...SUMMARY_TABLE_HEAD.slice(1)]],
    body: dispatcherSummaries.map((item) => {
      const row = totalsToSummaryRow(item.dispatcherName, item.totals);
      return [row[0], item.teamName, ...row.slice(1)];
    }),
    ...BREAKDOWN_SHARED_STYLES,
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  // ---- Grand totals strip ----
  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 24);
  y = drawSectionHeading(doc, "GRAND TOTALS", "bars", y);

  autoTable(doc, {
    startY: y,
    head: [SUMMARY_TABLE_HEAD],
    body: [totalsToSummaryRow("Grand Total", grandTotals)],
    ...BREAKDOWN_SHARED_STYLES,
    bodyStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  drawFooterOnAllPages(doc);

  doc.save(buildReportFilename());
}
