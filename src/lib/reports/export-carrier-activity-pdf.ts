import { ACTIVITY_APPROVAL_LABELS } from "@/lib/constants/activity-approval";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import type { Carrier, DailyActivity } from "@/lib/types";
import { computeAverageRatePerMile } from "@/lib/utils/compute-finance-metrics";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatActivityDate } from "@/lib/utils/format-date";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export type CarrierActivityPdfExportInput = {
  carrier: Carrier;
  activities: DailyActivity[];
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

const REPORT_TITLE = "Carrier Activity Report";
const MARGIN_X = 14;
const HEADER_COLOR: [number, number, number] = [15, 23, 42];
const SECTION_COLOR: [number, number, number] = [30, 41, 59];

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

function formatGeneratedAtLabel(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMiles(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

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
    notBookedLoads: activities.filter((row) => row.status === NOT_BOOKED).length,
    notWorkingLoads: activities.filter((row) => row.status === NOT_WORKING)
      .length,
    totalRevenue: delivered.reduce((sum, row) => sum + (row.loadAmount ?? 0), 0),
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
    ACTIVITY_APPROVAL_LABELS[activity.approvalStatus],
    activity.origin ?? "",
    activity.destination ?? "",
    activity.miles != null ? formatMiles(activity.miles) : "",
    isDelivered && activity.loadAmount != null
      ? formatCurrency(activity.loadAmount, { nullLabel: "" })
      : "",
    isDelivered ? formatRatePerMile(activity.ratePerMile, "") : "",
    isDelivered ? formatCurrency(activity.dispatchFee, { nullLabel: "" }) : "",
    activity.reason ?? "",
    activity.notes ?? "",
  ];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "carrier"
  );
}

function buildReportFilename(carrier: Carrier): string {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `carrier-${slugify(carrier.carrierName)}-activity-report-${dateKey}.pdf`;
}

function renderSectionTitle(
  doc: JsPdfDocument,
  title: string,
  y: number,
): number {
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

export async function exportCarrierActivityPdf({
  carrier,
  activities,
}: CarrierActivityPdfExportInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  }) as unknown as JsPdfDocument;

  const monthKey = currentMonthKey();
  const monthLabel = currentMonthLabel();
  const monthActivities = activities.filter(
    (activity) => (activity.date ?? "").slice(0, 7) === monthKey,
  );
  const monthlySummary = computeMonthlySummary(monthActivities);

  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(REPORT_TITLE, MARGIN_X, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(carrier.carrierName, MARGIN_X, y);
  y += 6;

  doc.setFontSize(10);
  doc.text(`Generated: ${formatGeneratedAtLabel()}`, MARGIN_X, y);
  y += 5;
  doc.text(`Total activities on record: ${activities.length}`, MARGIN_X, y);
  y += 8;

  // Carrier Details
  y = renderSectionTitle(doc, "Carrier Details", y);
  autoTable(doc, {
    startY: y,
    body: [
      ["Carrier Name", carrier.carrierName],
      ["Driver Name", carrier.driverName],
      ["MC Number", carrier.mcNumber],
      ["Truck Type", carrier.truckType.replaceAll("_", " ")],
      ["Assigned Team", carrier.assignedTeamName || "—"],
      ["Assigned Dispatcher", carrier.assignedDispatcherName || "—"],
      ["Dispatch Fee %", `${carrier.dispatchFeePercentage}%`],
      ["Status", carrier.status],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold", fillColor: [248, 250, 252] },
      1: { cellWidth: 110 },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 40);

  // Monthly Performance Summary
  y = renderSectionTitle(
    doc,
    `Monthly Performance Summary — ${monthLabel}`,
    y,
  );
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total Activities", String(monthlySummary.totalActivities)],
      ["Total Delivered Loads", String(monthlySummary.deliveredLoads)],
      ["Total Cancelled Loads", String(monthlySummary.cancelledLoads)],
      ["Total Not Booked Loads", String(monthlySummary.notBookedLoads)],
      ["Total Not Working Entries", String(monthlySummary.notWorkingLoads)],
      [
        "Total Revenue (Load Amount)",
        formatCurrency(monthlySummary.totalRevenue, { nullLabel: "$0.00" }),
      ],
      [
        "Total Dispatch Fee",
        formatCurrency(monthlySummary.totalDispatchFee, { nullLabel: "$0.00" }),
      ],
      [
        "Average Rate Per Mile",
        formatRatePerMile(monthlySummary.averageRatePerMile, "—"),
      ],
      ["Total Miles Covered", formatMiles(monthlySummary.totalMiles)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: SECTION_COLOR,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 70, halign: "right" },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  y = ensureSpace(doc, y, 30);

  // Detailed Activity History
  y = renderSectionTitle(
    doc,
    `Activity History (${activities.length} records)`,
    y,
  );

  if (activities.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("No activity history available.", MARGIN_X, y + 2);
    doc.setTextColor(0, 0, 0);
    doc.save(buildReportFilename(carrier));
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [HISTORY_TABLE_HEAD],
    body: activities.map((activity) => activityToHistoryRow(activity)),
    styles: {
      fontSize: 7.5,
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
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 14, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 28 },
      10: { cellWidth: 28 },
    },
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

  doc.save(buildReportFilename(carrier));
}
