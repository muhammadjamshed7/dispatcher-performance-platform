import {
  ACTIVITY_APPROVAL_LABELS,
  REJECTED,
} from "@/lib/constants/activity-approval";
import { DELIVERED } from "@/lib/constants/statuses";
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

type JsPdfDocument = {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (...args: number[]) => void;
  text: (text: string | string[], x: number, y: number) => void;
  addPage: () => void;
  save: (filename: string) => void;
  lastAutoTable?: {
    finalY: number;
  };
};

const REPORT_TITLE = "Daily Activities Report";
const MARGIN_X = 14;
const HEADER_COLOR: [number, number, number] = [15, 23, 42];
const SECTION_COLOR: [number, number, number] = [30, 41, 59];

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

function formatGeneratedAtLabel(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMiles(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
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
    activity.carrierName,
    activity.dispatcherName,
    activity.teamName,
    activity.truckType.replaceAll("_", " "),
    getLoadActivityStatusLabel(activity.status),
    activity.origin ?? "",
    activity.destination ?? "",
    activity.miles != null ? formatMiles(activity.miles) : "",
    isDelivered && activity.loadAmount != null
      ? formatCurrency(activity.loadAmount, { nullLabel: "" })
      : "",
    isDelivered ? formatRatePerMile(activity.ratePerMile, "") : "",
    isDelivered ? formatCurrency(activity.dispatchFee, { nullLabel: "" }) : "",
    activity.reason ?? "",
    notesCell,
  ];

  if (includeApprovalDetails) {
    row.splice(6, 0, ACTIVITY_APPROVAL_LABELS[activity.approvalStatus]);
  }

  return row;
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
    formatRatePerMile(totals.averageRatePerMile, "—"),
    formatCurrency(totals.totalDispatchFee, { nullLabel: "$0.00" }),
  ];
}

function buildReportFilename(): string {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `daily-activities-report-${dateKey}.pdf`;
}

function renderSectionTitle(doc: JsPdfDocument, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SECTION_COLOR);
  doc.text(title, MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

function ensureSpace(
  doc: JsPdfDocument,
  currentY: number,
  requiredHeight: number,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (currentY + requiredHeight <= pageHeight - 14) {
    return currentY;
  }

  doc.addPage();
  return 18;
}

export async function exportDailyActivitiesPdf({
  activities,
  filterContext,
  includeApprovalDetails = false,
}: DailyActivitiesPdfExportInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  }) as unknown as JsPdfDocument;

  const filterLines = buildActivitiesReportFilterLines(filterContext);
  const grandTotals = calculateActivityFinancialTotals(activities);
  const carrierSummaries = groupActivitiesByCarrier(activities);
  const dispatcherSummaries = groupActivitiesByDispatcher(activities);

  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(REPORT_TITLE, MARGIN_X, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Generated: ${formatGeneratedAtLabel()}`, MARGIN_X, y);
  y += 5;
  doc.text(`Records: ${activities.length}`, MARGIN_X, y);
  y += 6;

  for (const line of filterLines) {
    doc.text(line, MARGIN_X, y);
    y += 4.5;
  }

  y += 4;

  // With the extra "Approval" column we let autoTable auto-distribute widths to
  // avoid overflowing the landscape page; the fixed layout is tuned for the
  // 14-column report.
  const activityColumnStyles: Record<
    number,
    { cellWidth?: number; halign?: "right" }
  > = includeApprovalDetails
    ? {
        8: { halign: "right" as const },
        9: { halign: "right" as const },
        10: { halign: "right" as const },
        11: { halign: "right" as const },
        12: { halign: "right" as const },
      }
    : {
        0: { cellWidth: 16 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 14 },
        5: { cellWidth: 16 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 12, halign: "right" as const },
        9: { cellWidth: 16, halign: "right" as const },
        10: { cellWidth: 14, halign: "right" as const },
        11: { cellWidth: 16, halign: "right" as const },
        12: { cellWidth: 24 },
        13: { cellWidth: 24 },
      };

  autoTable(doc, {
    startY: y,
    head: [buildActivityTableHead(includeApprovalDetails)],
    body: activities.map((activity) =>
      activityToPdfRow(activity, includeApprovalDetails),
    ),
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: activityColumnStyles,
    margin: { left: MARGIN_X, right: MARGIN_X },
    didDrawPage: (data) => {
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - MARGIN_X,
        doc.internal.pageSize.getHeight() - 8,
      );
      doc.setTextColor(0, 0, 0);
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 24);
  y = renderSectionTitle(doc, "Filtered Activity Totals", y);

  autoTable(doc, {
    startY: y,
    head: [SUMMARY_TABLE_HEAD],
    body: [totalsToSummaryRow("All Filtered Activities", grandTotals)],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: SECTION_COLOR,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 30);
  y = renderSectionTitle(doc, "Totals by Carrier", y);

  autoTable(doc, {
    startY: y,
    head: [SUMMARY_TABLE_HEAD],
    body: carrierSummaries.map((summary) =>
      totalsToSummaryRow(summary.carrierName, summary.totals),
    ),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: SECTION_COLOR,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 30);
  y = renderSectionTitle(doc, "Totals by Dispatcher", y);

  autoTable(doc, {
    startY: y,
    head: [["Dispatcher", "Team", ...SUMMARY_TABLE_HEAD.slice(1)]],
    body: dispatcherSummaries.map((summary) => {
      const row = totalsToSummaryRow(summary.dispatcherName, summary.totals);
      return [row[0], summary.teamName, ...row.slice(1)];
    }),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: SECTION_COLOR,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 24);
  y = renderSectionTitle(doc, "Grand Totals", y);

  autoTable(doc, {
    startY: y,
    head: [SUMMARY_TABLE_HEAD],
    body: [totalsToSummaryRow("Grand Total", grandTotals)],
    styles: { fontSize: 8, cellPadding: 2.2, fontStyle: "bold" },
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontStyle: "bold",
    },
    bodyStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
    },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  doc.save(buildReportFilename());
}
