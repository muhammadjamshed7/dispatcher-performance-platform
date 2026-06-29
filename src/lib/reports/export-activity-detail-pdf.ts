import {
  APPROVED,
  EDIT_ACTIVITY,
  REJECTED,
} from "@/lib/constants/activity-approval";
import type { ActivityApprovalStatus } from "@/lib/constants/activity-approval";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import type { DailyActivity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatActivityDate, formatDate } from "@/lib/utils/format-date";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

import {
  APPROVAL_BADGE_BY_LABEL,
  BORDER_COLOR,
  DASH,
  GRAY_BADGE,
  LIGHT_GRAY_ROW,
  PAGE_MARGIN,
  STATUS_BADGE_BY_LABEL,
  TEXT_COLOR,
  drawBadge,
  drawFooterOnAllPages,
  drawReportHeader,
  drawSectionHeading,
  formatGeneratedAtLabel,
  formatMiles,
  loadLogo,
  nullableText,
  slugify,
  type JsPdfDocument,
} from "./pdf-theme";

export type ActivityDetailPdfExportInput = {
  activity: DailyActivity;
};

const DATETIME_PATTERN = "MMM d, yyyy 'at' h:mm a";

const LABEL_CELL_STYLE = {
  fontStyle: "bold" as const,
  fillColor: LIGHT_GRAY_ROW,
  textColor: TEXT_COLOR,
};

const GRID_TABLE_STYLES = {
  theme: "grid" as const,
  styles: {
    fontSize: 9,
    cellPadding: 2.6,
    valign: "middle" as const,
    overflow: "linebreak" as const,
    textColor: TEXT_COLOR,
    lineColor: BORDER_COLOR,
    lineWidth: 0.1,
  },
};

function approvalShortLabel(status: ActivityApprovalStatus): string {
  if (status === APPROVED) return "Approved";
  if (status === REJECTED) return "Rejected";
  return "Pending";
}

function resolveLastUpdated(activity: DailyActivity): string | null {
  const candidates = [
    activity.rejectedAt,
    activity.adminApprovedAt,
    activity.teamLeadApprovedAt,
    activity.submittedAt,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return null;
  }

  return candidates
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .sort((a, b) => b.time - a.time)[0].value;
}

function buildReportFilename(activity: DailyActivity): string {
  return `activity-${slugify(activity.carrierName, "activity")}-${slugify(
    activity.date,
    "report",
  )}.pdf`;
}

export async function exportActivityDetailPdf({
  activity,
}: ActivityDetailPdfExportInput): Promise<void> {
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;

  const isEdit = activity.approvalType === EDIT_ACTIVITY;
  const isRejected = activity.approvalStatus === REJECTED;

  const statusLabel = getLoadActivityStatusLabel(activity.status);
  const statusPalette = STATUS_BADGE_BY_LABEL[statusLabel] ?? GRAY_BADGE;
  const approvalLabel = approvalShortLabel(activity.approvalStatus);
  const approvalPalette = APPROVAL_BADGE_BY_LABEL[approvalLabel] ?? GRAY_BADGE;

  let y = drawReportHeader(doc, {
    title: "ACTIVITY REPORT",
    accentLine: `${activity.carrierName} • Activity on ${formatActivityDate(
      activity.date,
    )}`,
    metaLines: [`Generated: ${formatGeneratedAtLabel()}`],
    logo,
  });

  // ---- Section 1: Basic Activity Information ----
  y = drawSectionHeading(doc, "BASIC ACTIVITY INFORMATION", "clipboard", y);

  autoTable(doc, {
    startY: y,
    body: [
      [
        "Activity Date",
        formatActivityDate(activity.date),
        "Submitted On",
        formatDate(activity.submittedAt, DATETIME_PATTERN, DASH),
      ],
      [
        "Activity Type",
        isEdit ? "Edit" : "New",
        "Carrier",
        activity.carrierName,
      ],
      [
        "Driver",
        nullableText(activity.driverName),
        "Dispatcher",
        nullableText(activity.dispatcherName),
      ],
      [
        "Team",
        nullableText(activity.teamName),
        "Truck Type",
        activity.truckType.replaceAll("_", " "),
      ],
      ["Load Status", statusLabel, "Approval Status", approvalLabel],
    ],
    ...GRID_TABLE_STYLES,
    columnStyles: {
      0: { ...LABEL_CELL_STYLE, cellWidth: 34 },
      1: { cellWidth: 57 },
      2: { ...LABEL_CELL_STYLE, cellWidth: 34 },
      3: { cellWidth: 57 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.row.index === 4 &&
        (data.column.index === 1 || data.column.index === 3)
      ) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.row.index !== 4) {
        return;
      }

      const centerX = data.cell.x + data.cell.width / 2;
      const centerY = data.cell.y + data.cell.height / 2;

      if (data.column.index === 1) {
        drawBadge(doc, centerX, centerY, statusLabel, statusPalette, 8);
      } else if (data.column.index === 3) {
        drawBadge(doc, centerX, centerY, approvalLabel, approvalPalette, 8);
      }
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 9;

  // ---- Section 2: Load & Work Details ----
  y = drawSectionHeading(doc, "LOAD & WORK DETAILS", "bars", y);

  autoTable(doc, {
    startY: y,
    body: [
      [
        "Origin",
        nullableText(activity.origin),
        "Destination",
        nullableText(activity.destination),
      ],
      [
        "Total Miles",
        activity.miles != null ? formatMiles(activity.miles) : "N/A",
        "Load Amount",
        formatCurrency(activity.loadAmount, { nullLabel: "N/A" }),
      ],
      [
        "Rate Per Mile",
        formatRatePerMile(activity.ratePerMile, "N/A"),
        "Dispatch Fee Earned",
        formatCurrency(activity.dispatchFee, { nullLabel: "N/A" }),
      ],
    ],
    ...GRID_TABLE_STYLES,
    columnStyles: {
      0: { ...LABEL_CELL_STYLE, cellWidth: 34 },
      1: { cellWidth: 57 },
      2: { ...LABEL_CELL_STYLE, cellWidth: 34 },
      3: { cellWidth: 57 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 9;

  // ---- Section 3: Notes & Reason ----
  y = drawSectionHeading(doc, "NOTES & REASON", "note", y);

  autoTable(doc, {
    startY: y,
    body: [
      ["Reason", nullableText(activity.reason)],
      ["Notes", nullableText(activity.notes)],
    ],
    ...GRID_TABLE_STYLES,
    columnStyles: {
      0: { ...LABEL_CELL_STYLE, cellWidth: 34 },
      1: { cellWidth: usableWidth - 34 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 9;

  // ---- Section 4: Approval Timeline ----
  y = drawSectionHeading(doc, "APPROVAL TIMELINE", "clock", y);

  const timelineRows: string[][] = [
    ["Created", formatDate(activity.submittedAt, DATETIME_PATTERN, DASH)],
    [
      "Last Updated",
      formatDate(resolveLastUpdated(activity), DATETIME_PATTERN, DASH),
    ],
  ];

  if (activity.rejectedAt) {
    timelineRows.push([
      "Rejected",
      formatDate(activity.rejectedAt, DATETIME_PATTERN, DASH),
    ]);
  } else if (activity.approvalStatus === APPROVED) {
    const approvedAt = activity.adminApprovedAt ?? activity.teamLeadApprovedAt;
    timelineRows.push([
      "Approved",
      formatDate(approvedAt, DATETIME_PATTERN, DASH),
    ]);
  }

  autoTable(doc, {
    startY: y,
    body: timelineRows,
    ...GRID_TABLE_STYLES,
    columnStyles: {
      0: { ...LABEL_CELL_STYLE, cellWidth: 34 },
      1: { cellWidth: usableWidth - 34 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 9;

  // ---- Section 5: Rejection Feedback (only when rejected with feedback) ----
  if (isRejected && activity.rejectionReason) {
    const headingHeight = 11.5;
    const feedbackLines = doc.splitTextToSize(
      activity.rejectionReason,
      usableWidth - 10,
    );
    const boxHeight = 12 + feedbackLines.length * 4.6;

    if (y + headingHeight + boxHeight > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }

    y = drawSectionHeading(doc, "REJECTION FEEDBACK", "note", y);

    // Red alert card: bg #FEF2F2, border #FCA5A5, text #DC2626.
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.setLineWidth(0.4);
    doc.roundedRect(PAGE_MARGIN, y, usableWidth, boxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(220, 38, 38);
    doc.text("Reason for rejection", PAGE_MARGIN + 5, y + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(feedbackLines, PAGE_MARGIN + 5, y + 12);
    doc.setTextColor(0, 0, 0);
  }

  drawFooterOnAllPages(doc);

  doc.save(buildReportFilename(activity));
}
