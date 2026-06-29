import {
  deriveAuditModule,
  formatAuditAction,
  formatAuditData,
} from "@/lib/audit/audit-log-format";
import type { AuditLogEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils/format-date";

export type AuditLogsPdfExportInput = {
  entries: AuditLogEntry[];
  /** Human-readable lines describing the applied filters/search. */
  filterSummary?: string[];
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
  save: (filename: string) => void;
  lastAutoTable?: {
    finalY: number;
  };
};

const REPORT_TITLE = "Audit Logs Report";
const MARGIN_X = 14;
const HEADER_COLOR: [number, number, number] = [15, 23, 42];

const TABLE_HEAD = [
  "Timestamp",
  "Status",
  "Action",
  "Module",
  "Record",
  "Performed By",
  "Role",
  "Team",
  "Dispatcher",
  "Notes",
  "Previous Data",
  "Updated Data",
];

function formatGeneratedAtLabel(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function entryToRow(entry: AuditLogEntry): string[] {
  return [
    formatDate(entry.createdAt),
    entry.status,
    formatAuditAction(entry.action),
    deriveAuditModule(entry.entityType),
    entry.entityId ?? "—",
    entry.actorName ?? "System",
    entry.actorRole ? entry.actorRole.replaceAll("_", " ") : "—",
    entry.teamName ?? "—",
    entry.dispatcherName ?? "—",
    entry.notes ?? "",
    formatAuditData(entry.oldData),
    formatAuditData(entry.newData),
  ];
}

function buildReportFilename(): string {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `audit-logs-${dateKey}.pdf`;
}

export async function exportAuditLogsPdf({
  entries,
  filterSummary = [],
}: AuditLogsPdfExportInput): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  }) as unknown as JsPdfDocument;

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
  doc.text(`Records: ${entries.length}`, MARGIN_X, y);
  y += 6;

  for (const line of filterSummary) {
    doc.text(line, MARGIN_X, y);
    y += 4.5;
  }

  y += 4;

  if (entries.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text("No audit logs available for the selected filters.", MARGIN_X, y);
    doc.setTextColor(0, 0, 0);
    doc.save(buildReportFilename());
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [TABLE_HEAD],
    body: entries.map((entry) => entryToRow(entry)),
    styles: {
      fontSize: 6.5,
      cellPadding: 1.4,
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
      0: { cellWidth: 24 },
      1: { cellWidth: 16 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 24 },
      6: { cellWidth: 16 },
      7: { cellWidth: 18 },
      8: { cellWidth: 20 },
      9: { cellWidth: 24 },
      10: { cellWidth: 22 },
      11: { cellWidth: 22 },
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

  doc.save(buildReportFilename());
}
