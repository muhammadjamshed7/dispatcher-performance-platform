import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import type { HAlignType, Styles, VAlignType } from "jspdf-autotable";

import type {
  CarrierReportRow,
  DailyActivity,
  DispatcherReportRow,
  ReportBundle,
  TeamReportRow,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatNullableText } from "@/lib/utils/format-display";
import { formatPercent } from "@/lib/utils/format-percent";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

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
  WHITE,
  drawReportHeader,
  drawSectionHeading,
  formatGeneratedAtLabel,
  loadLogo,
  slugify,
  type JsPdfDocument,
} from "./pdf-theme";

type AppliedFilter = {
  label: string;
  value: string;
};

type ColumnStyles = Record<number, Partial<Styles>>;

export type PerformanceReportPdfInput = {
  report: ReportBundle;
  reportTypeLabel: string;
  dateRangeLabel: string;
  appliedFilters: AppliedFilter[];
};

const FOOTER_HEIGHT = 22;
const EMPTY_LABEL = "N/A";

function isReportEmpty(report: ReportBundle): boolean {
  return (
    report.daily.length === 0 &&
    report.dispatchers.length === 0 &&
    report.carriers.length === 0 &&
    report.teams.length === 0
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY_LABEL;
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatText(value: string | null | undefined): string {
  return formatNullableText(value, EMPTY_LABEL);
}

function drawFooterOnAllPages(doc: JsPdfDocument): void {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(...PRIMARY_BLUE);
    doc.setLineWidth(0.3);
    doc.line(
      PAGE_MARGIN,
      pageHeight - 14,
      pageWidth - PAGE_MARGIN,
      pageHeight - 14,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_MARGIN, pageHeight - 8);
    doc.text(
      "This is a system generated report.",
      pageWidth - PAGE_MARGIN,
      pageHeight - 8,
      { align: "right" },
    );
  }

  doc.setTextColor(0, 0, 0);
}

function ensureSpace(
  doc: JsPdfDocument,
  y: number,
  neededHeight: number,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (y + neededHeight <= pageHeight - FOOTER_HEIGHT) {
    return y;
  }

  doc.addPage();
  return PAGE_MARGIN;
}

function drawSummaryCards(
  doc: JsPdfDocument,
  report: ReportBundle,
  startY: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;
  const gap = 4;
  const cardWidth = (usableWidth - gap * 4) / 5;
  const cardHeight = 20;
  const metrics = [
    {
      label: "Revenue",
      value: formatCurrency(report.summary.revenue, { nullLabel: "$0.00" }),
    },
    {
      label: "Dispatch Fees",
      value: formatCurrency(report.summary.dispatchFees, {
        nullLabel: "$0.00",
      }),
    },
    {
      label: "Delivered Loads",
      value: formatCount(report.summary.deliveredLoads),
    },
    {
      label: "Cancelled Loads",
      value: formatCount(report.summary.cancelledLoads),
    },
    {
      label: "Active Carriers",
      value: formatCount(report.summary.activeCarriers),
    },
  ];

  let y = ensureSpace(doc, startY, cardHeight + 8);

  metrics.forEach((metric, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + gap);

    doc.setFillColor(...LIGHT_BLUE_BG);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(metric.label.toUpperCase(), x + 3, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK_NAVY);
    const valueLines = doc.splitTextToSize(metric.value, cardWidth - 6);
    doc.text(valueLines.slice(0, 2), x + 3, y + 13);
  });

  doc.setTextColor(0, 0, 0);
  y += cardHeight + 9;
  return y;
}

function drawNoDataMessage(doc: JsPdfDocument, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - PAGE_MARGIN * 2;
  const y = ensureSpace(doc, startY, 22);

  doc.setFillColor(...LIGHT_GRAY_ROW);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.2);
  doc.roundedRect(PAGE_MARGIN, y, width, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_COLOR);
  doc.text(
    "No report data available for the selected period and filters.",
    PAGE_MARGIN + 5,
    y + 10.5,
  );

  doc.setTextColor(0, 0, 0);
  return y + 26;
}

function buildStatusRows(report: ReportBundle): string[][] {
  const total = report.daily.length;
  const statuses = [DELIVERED, CANCELLED, NOT_BOOKED, NOT_WORKING];

  return statuses.map((status) => {
    const count = report.daily.filter((row) => row.status === status).length;
    const percent = total > 0 ? (count / total) * 100 : 0;

    return [
      getLoadActivityStatusLabel(status),
      formatCount(count),
      formatPercent(percent),
    ];
  });
}

function buildRevenueRows(report: ReportBundle): string[][] {
  const deliveredLoads = report.summary.deliveredLoads;

  return [
    [
      "Total Revenue",
      formatCurrency(report.summary.revenue, { nullLabel: "$0.00" }),
    ],
    [
      "Total Dispatch Fees",
      formatCurrency(report.summary.dispatchFees, { nullLabel: "$0.00" }),
    ],
    [
      "Average Revenue per Delivered Load",
      deliveredLoads > 0
        ? formatCurrency(report.summary.revenue / deliveredLoads)
        : EMPTY_LABEL,
    ],
    [
      "Average Dispatch Fee per Delivered Load",
      deliveredLoads > 0
        ? formatCurrency(report.summary.dispatchFees / deliveredLoads)
        : EMPTY_LABEL,
    ],
  ];
}

function buildActivityRows(report: ReportBundle): string[][] {
  const totalActivities = report.daily.length;
  const notBooked = report.daily.filter(
    (row) => row.status === NOT_BOOKED,
  ).length;
  const notWorking = report.daily.filter(
    (row) => row.status === NOT_WORKING,
  ).length;

  return [
    ["Total Activity Rows", formatCount(totalActivities)],
    ["Delivered Loads", formatCount(report.summary.deliveredLoads)],
    ["Cancelled Loads", formatCount(report.summary.cancelledLoads)],
    ["Not Booked Count", formatCount(notBooked)],
    ["Not Working Count", formatCount(notWorking)],
    ["Active Carriers", formatCount(report.summary.activeCarriers)],
  ];
}

function dailyActivityRows(rows: DailyActivity[]): string[][] {
  return rows.map((row) => [
    row.date,
    row.dispatcherName,
    row.teamName,
    row.carrierName,
    row.truckType.replaceAll("_", " "),
    getLoadActivityStatusLabel(row.status),
    formatText(row.origin),
    formatText(row.destination),
    formatNumber(row.miles),
    formatCurrency(row.loadAmount),
    row.status === DELIVERED ? formatRatePerMile(row.ratePerMile) : EMPTY_LABEL,
    row.status === DELIVERED ? formatCurrency(row.dispatchFee) : EMPTY_LABEL,
    formatText(row.reason),
    formatText(row.notes),
  ]);
}

function dispatcherRows(rows: DispatcherReportRow[]): string[][] {
  return rows.map((row) => [
    row.dispatcherName,
    row.teamName,
    formatCount(row.deliveredLoads),
    formatCount(row.cancelledLoads),
    formatCount(row.notBookedCount),
    formatCount(row.notWorkingCount),
    formatCurrency(row.revenue),
    formatCurrency(row.dispatchFees),
    formatRatePerMile(row.averageRatePerMile),
    formatPercent(row.cancellationRate),
    formatPercent(row.bookingEfficiency),
  ]);
}

function carrierRows(rows: CarrierReportRow[]): string[][] {
  return rows.map((row) => [
    row.carrierName,
    row.driverName,
    row.mcNumber,
    row.dispatcherName,
    row.teamName,
    row.truckType.replaceAll("_", " "),
    formatCount(row.deliveredLoads),
    formatCount(row.cancelledLoads),
    formatCount(row.notBookedCount),
    formatCount(row.notWorkingCount),
    formatCurrency(row.revenue),
    formatCurrency(row.dispatchFees),
    formatRatePerMile(row.averageRatePerMile),
    formatCount(row.activityScore),
  ]);
}

function teamRows(rows: TeamReportRow[]): string[][] {
  return rows.map((row) => [
    row.teamName,
    row.teamLeadName,
    formatCount(row.dispatchers),
    formatCount(row.activeCarriers),
    formatCount(row.deliveredLoads),
    formatCount(row.cancelledLoads),
    formatCurrency(row.revenue),
    formatCurrency(row.dispatchFees),
    formatRatePerMile(row.averageRatePerMile),
    formatPercent(row.cancellationRate),
    formatCount(row.teamRank),
  ]);
}

function tableBaseStyles() {
  return {
    theme: "grid" as const,
    showHead: "everyPage" as const,
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      overflow: "linebreak" as const,
      valign: "middle" as VAlignType,
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: TABLE_NAVY,
      textColor: WHITE,
      fontStyle: "bold" as const,
      halign: "center" as HAlignType,
      valign: "middle" as VAlignType,
      fontSize: 7.4,
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY_ROW },
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      top: PAGE_MARGIN,
      bottom: FOOTER_HEIGHT,
    },
  };
}

function addSectionTable(
  doc: JsPdfDocument,
  autoTable: typeof import("jspdf-autotable").default,
  title: string,
  head: string[],
  body: string[][],
  startY: number,
  columnStyles?: ColumnStyles,
): number {
  let y = ensureSpace(doc, startY, 30);
  y = drawSectionHeading(doc, title, "clipboard", y);

  if (body.length === 0) {
    return drawNoDataMessage(doc, y);
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    ...tableBaseStyles(),
    columnStyles,
  });

  return (doc.lastAutoTable?.finalY ?? y) + 9;
}

function buildFilename(reportTypeLabel: string): string {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `performance-report-${slugify(reportTypeLabel)}-${dateKey}.pdf`;
}

export async function exportPerformanceReportPdf({
  report,
  reportTypeLabel,
  dateRangeLabel,
  appliedFilters,
}: PerformanceReportPdfInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  }) as unknown as JsPdfDocument;

  const logo = await loadLogo();

  let y = drawReportHeader(doc, {
    title: "PERFORMANCE REPORT",
    accentLine: "Dispatcher Performance Platform",
    metaLines: [
      `Report type: ${reportTypeLabel}`,
      `Generated: ${formatGeneratedAtLabel()}`,
      `Date range: ${dateRangeLabel}`,
      "Applied filters: See filter summary below",
    ],
    logo,
    accentBarHeight: 25,
  });

  autoTable(doc, {
    startY: y,
    head: [["Applied Filter", "Value"]],
    body: [
      ["Date Range", dateRangeLabel],
      ...appliedFilters.map((filter) => [filter.label, filter.value]),
    ],
    ...tableBaseStyles(),
    styles: {
      ...tableBaseStyles().styles,
      fontSize: 8,
      cellPadding: 2.1,
    },
    headStyles: {
      ...tableBaseStyles().headStyles,
      fontSize: 8.2,
    },
    columnStyles: {
      0: {
        cellWidth: 45,
        fontStyle: "bold" as const,
        fillColor: LIGHT_GRAY_ROW,
      },
      1: { cellWidth: 210 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 9;

  if (isReportEmpty(report)) {
    drawNoDataMessage(doc, y);
    drawFooterOnAllPages(doc);
    doc.save(buildFilename(reportTypeLabel));
    return;
  }

  y = drawSectionHeading(
    doc,
    "SUMMARY METRICS",
    "bars",
    ensureSpace(doc, y, 34),
  );
  y = drawSummaryCards(doc, report, y);

  const pageWidth = doc.internal.pageSize.getWidth();
  const halfWidth = (pageWidth - PAGE_MARGIN * 2 - 6) / 2;
  const summaryTableStartY = ensureSpace(doc, y, 50);

  autoTable(doc, {
    startY: summaryTableStartY,
    head: [["Revenue Summary", "Value"]],
    body: buildRevenueRows(report),
    ...tableBaseStyles(),
    tableWidth: halfWidth,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_HEIGHT },
    columnStyles: {
      0: { cellWidth: halfWidth - 42, fontStyle: "bold" as const },
      1: { cellWidth: 42, halign: "right" as const },
    },
  });
  const revenueFinalY = doc.lastAutoTable?.finalY ?? summaryTableStartY;

  autoTable(doc, {
    startY: summaryTableStartY,
    head: [["Load / Activity Summary", "Value"]],
    body: buildActivityRows(report),
    ...tableBaseStyles(),
    tableWidth: halfWidth,
    margin: {
      left: PAGE_MARGIN + halfWidth + 6,
      right: PAGE_MARGIN,
      bottom: FOOTER_HEIGHT,
    },
    columnStyles: {
      0: { cellWidth: halfWidth - 34, fontStyle: "bold" as const },
      1: { cellWidth: 34, halign: "right" as const },
    },
  });
  const activityFinalY = doc.lastAutoTable?.finalY ?? summaryTableStartY;
  y = Math.max(revenueFinalY, activityFinalY) + 9;

  y = addSectionTable(
    doc,
    autoTable,
    "STATUS BREAKDOWN",
    ["Status", "Count", "Share"],
    buildStatusRows(report),
    y,
    {
      0: { cellWidth: 80 },
      1: { cellWidth: 35, halign: "right" as const },
      2: { cellWidth: 35, halign: "right" as const },
    },
  );

  if (report.dispatchers.length > 0) {
    y = addSectionTable(
      doc,
      autoTable,
      "DISPATCHER BREAKDOWN",
      [
        "Dispatcher Name",
        "Team",
        "Delivered Loads",
        "Cancelled Loads",
        "Not Booked",
        "Not Working",
        "Revenue",
        "Dispatch Fees",
        "Avg Rate/Mi",
        "Cancellation Rate",
        "Booking Efficiency",
      ],
      dispatcherRows(report.dispatchers),
      y,
      {
        0: { cellWidth: 34 },
        1: { cellWidth: 28 },
        2: { cellWidth: 20, halign: "right" as const },
        3: { cellWidth: 20, halign: "right" as const },
        4: { cellWidth: 19, halign: "right" as const },
        5: { cellWidth: 19, halign: "right" as const },
        6: { cellWidth: 24, halign: "right" as const },
        7: { cellWidth: 24, halign: "right" as const },
        8: { cellWidth: 23, halign: "right" as const },
        9: { cellWidth: 24, halign: "right" as const },
        10: { cellWidth: 24, halign: "right" as const },
      },
    );
  }

  if (report.carriers.length > 0) {
    y = addSectionTable(
      doc,
      autoTable,
      "CARRIER BREAKDOWN",
      [
        "Carrier Name",
        "Driver Name",
        "MC Number",
        "Dispatcher",
        "Team",
        "Truck Type",
        "Delivered",
        "Cancelled",
        "Not Booked",
        "Not Working",
        "Revenue",
        "Dispatch Fees",
        "Avg Rate/Mi",
        "Activity Score",
      ],
      carrierRows(report.carriers),
      y,
      {
        0: { cellWidth: 28 },
        1: { cellWidth: 25 },
        2: { cellWidth: 18 },
        3: { cellWidth: 28 },
        4: { cellWidth: 24 },
        5: { cellWidth: 22 },
        6: { cellWidth: 16, halign: "right" as const },
        7: { cellWidth: 16, halign: "right" as const },
        8: { cellWidth: 16, halign: "right" as const },
        9: { cellWidth: 16, halign: "right" as const },
        10: { cellWidth: 22, halign: "right" as const },
        11: { cellWidth: 22, halign: "right" as const },
        12: { cellWidth: 20, halign: "right" as const },
        13: { cellWidth: 18, halign: "right" as const },
      },
    );
  }

  if (report.teams.length > 0) {
    y = addSectionTable(
      doc,
      autoTable,
      "TEAM BREAKDOWN",
      [
        "Team Name",
        "Team Lead",
        "Dispatchers",
        "Active Carriers",
        "Delivered Loads",
        "Cancelled Loads",
        "Revenue",
        "Dispatch Fees",
        "Avg Rate/Mi",
        "Cancellation Rate",
        "Team Rank",
      ],
      teamRows(report.teams),
      y,
      {
        0: { cellWidth: 34 },
        1: { cellWidth: 34 },
        2: { cellWidth: 20, halign: "right" as const },
        3: { cellWidth: 22, halign: "right" as const },
        4: { cellWidth: 22, halign: "right" as const },
        5: { cellWidth: 22, halign: "right" as const },
        6: { cellWidth: 26, halign: "right" as const },
        7: { cellWidth: 26, halign: "right" as const },
        8: { cellWidth: 24, halign: "right" as const },
        9: { cellWidth: 24, halign: "right" as const },
        10: { cellWidth: 18, halign: "right" as const },
      },
    );
  }

  addSectionTable(
    doc,
    autoTable,
    `${reportTypeLabel.toUpperCase()} REPORT - ACTIVITY DETAIL`,
    [
      "Date",
      "Dispatcher",
      "Team",
      "Carrier",
      "Truck Type",
      "Status",
      "Origin",
      "Destination",
      "Miles",
      "Load Amount",
      "Rate/Mi",
      "Dispatch Fee",
      "Reason",
      "Notes",
    ],
    dailyActivityRows(report.daily),
    y,
    {
      0: { cellWidth: 19 },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 25 },
      4: { cellWidth: 20 },
      5: { cellWidth: 19 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 },
      8: { cellWidth: 13, halign: "right" as const },
      9: { cellWidth: 20, halign: "right" as const },
      10: { cellWidth: 17, halign: "right" as const },
      11: { cellWidth: 19, halign: "right" as const },
      12: { cellWidth: 18 },
      13: { cellWidth: 18 },
    },
  );

  drawFooterOnAllPages(doc);
  doc.save(buildFilename(reportTypeLabel));
}
