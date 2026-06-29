/**
 * Shared design primitives for the corporate PDF reports (carrier activity,
 * single activity, and multi-activity exports). Centralizing the palette,
 * badge styles, and drawing helpers keeps every report visually consistent and
 * avoids duplicating the jsPDF plumbing across report files.
 */

export type RGB = [number, number, number];

type TextOptions = { align?: "left" | "center" | "right"; baseline?: string };

export type JsPdfDocument = {
  internal: {
    pageSize: { getWidth: () => number; getHeight: () => number };
    getNumberOfPages: () => number;
  };
  setPage: (pageNumber: number) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (...args: number[]) => void;
  setFillColor: (...args: number[]) => void;
  setDrawColor: (...args: number[]) => void;
  setLineWidth: (width: number) => void;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: TextOptions,
  ) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void;
  circle: (x: number, y: number, r: number, style?: string) => void;
  triangle?: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    style?: string,
  ) => void;
  addImage: (
    data: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
  getTextWidth: (text: string) => number;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addPage: () => void;
  save: (filename: string) => void;
  lastAutoTable?: { finalY: number };
};

// Theme palette (see design spec).
export const PRIMARY_BLUE: RGB = [37, 99, 235];
export const DARK_NAVY: RGB = [15, 23, 42];
export const TABLE_NAVY: RGB = [11, 31, 58];
export const TEXT_COLOR: RGB = [17, 24, 39];
export const MUTED_COLOR: RGB = [107, 114, 128];
export const BORDER_COLOR: RGB = [229, 231, 235];
export const LIGHT_BLUE_BG: RGB = [239, 246, 255];
export const LIGHT_GRAY_ROW: RGB = [249, 250, 251];
export const WHITE: RGB = [255, 255, 255];

export type BadgePalette = { text: RGB; bg: RGB; border: RGB };

export const GREEN_BADGE: BadgePalette = {
  text: [22, 163, 74],
  bg: [220, 252, 231],
  border: [134, 239, 172],
};
export const ORANGE_BADGE: BadgePalette = {
  text: [234, 88, 12],
  bg: [255, 237, 213],
  border: [253, 186, 116],
};
export const RED_BADGE: BadgePalette = {
  text: [220, 38, 38],
  bg: [254, 226, 226],
  border: [252, 165, 165],
};
export const AMBER_BADGE: BadgePalette = {
  text: [146, 64, 14],
  bg: [254, 243, 199],
  border: [252, 211, 77],
};
export const GRAY_BADGE: BadgePalette = {
  text: [107, 114, 128],
  bg: [243, 244, 246],
  border: [229, 231, 235],
};

export const STATUS_BADGE_BY_LABEL: Record<string, BadgePalette> = {
  Delivered: GREEN_BADGE,
  "Not Booked": ORANGE_BADGE,
  Cancelled: RED_BADGE,
  "Not Working": GRAY_BADGE,
};

export const APPROVAL_BADGE_BY_LABEL: Record<string, BadgePalette> = {
  Approved: GREEN_BADGE,
  Rejected: RED_BADGE,
  Pending: AMBER_BADGE,
};

export const PAGE_MARGIN = 14;
export const DASH = "—";

export function formatGeneratedAtLabel(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatMiles(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function nullableText(value: string | null | undefined): string {
  const text = value?.toString().trim();
  return text ? text : DASH;
}

export function slugify(value: string, fallback = "report"): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback
  );
}

export type LogoAsset = {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
};

export function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
  const type = match?.[1]?.toUpperCase();
  if (type === "JPG") return "JPEG";
  return type ?? "JPEG";
}

export async function loadLogo(): Promise<LogoAsset | null> {
  try {
    const response = await fetch("/pdf_logo.jpeg");
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = reject;
        image.src = dataUrl;
      },
    );

    return {
      dataUrl,
      width: dimensions.width,
      height: dimensions.height,
      format: imageFormatFromDataUrl(dataUrl),
    };
  } catch {
    return null;
  }
}

export type SectionGlyph = "person" | "bars" | "clipboard" | "clock" | "note";

export function drawSectionGlyph(
  doc: JsPdfDocument,
  glyph: SectionGlyph,
  bx: number,
  by: number,
  size: number,
): void {
  doc.setFillColor(...PRIMARY_BLUE);
  doc.setDrawColor(...PRIMARY_BLUE);

  if (glyph === "person") {
    doc.circle(bx + size / 2, by + 2.5, 1.05, "F");
    doc.roundedRect(bx + size / 2 - 1.9, by + 3.9, 3.8, 2.2, 1.1, 1.1, "F");
    return;
  }

  if (glyph === "bars") {
    const base = by + size - 1.6;
    const heights = [2, 3.1, 2.5];
    heights.forEach((height, index) => {
      const x = bx + 1.7 + index * 1.6;
      doc.rect(x, base - height, 1.1, height, "F");
    });
    return;
  }

  if (glyph === "clock") {
    const cx = bx + size / 2;
    const cy = by + size / 2;
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, 2.0, "S");
    doc.line(cx, cy, cx, cy - 1.2);
    doc.line(cx, cy, cx + 1.0, cy);
    return;
  }

  if (glyph === "note") {
    doc.setLineWidth(0.4);
    const lx = bx + 1.9;
    const widths = [3.2, 3.2, 2.2];
    widths.forEach((width, index) => {
      const ly = by + 2.4 + index * 1.2;
      doc.line(lx, ly, lx + width, ly);
    });
    return;
  }

  // clipboard
  doc.setLineWidth(0.35);
  doc.roundedRect(bx + 2, by + 1.9, 3, 3.5, 0.5, 0.5, "S");
  doc.roundedRect(bx + 2.9, by + 1.3, 1.2, 0.9, 0.3, 0.3, "F");
}

export function drawSectionHeading(
  doc: JsPdfDocument,
  title: string,
  glyph: SectionGlyph,
  y: number,
): number {
  const boxSize = 7;
  doc.setFillColor(...LIGHT_BLUE_BG);
  doc.setDrawColor(...LIGHT_BLUE_BG);
  doc.roundedRect(PAGE_MARGIN, y, boxSize, boxSize, 1.6, 1.6, "F");
  drawSectionGlyph(doc, glyph, PAGE_MARGIN, y, boxSize);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text(title, PAGE_MARGIN + boxSize + 3.5, y + boxSize / 2 + 1.6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return y + boxSize + 4.5;
}

export function drawBadge(
  doc: JsPdfDocument,
  centerX: number,
  centerY: number,
  label: string,
  palette: BadgePalette,
  fontSize: number,
): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const textWidth = doc.getTextWidth(label);
  const paddingX = 2.2;
  const width = textWidth + paddingX * 2;
  const height = fontSize * 0.16 + 2.9;
  const x = centerX - width / 2;
  const y = centerY - height / 2;

  doc.setFillColor(...palette.bg);
  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, height / 2, height / 2, "FD");

  doc.setTextColor(...palette.text);
  doc.text(label, centerX, centerY, { align: "center", baseline: "middle" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

/**
 * Draws the footer (thin blue divider + centered "Page N") on the current page.
 * Pass `pageLabel` to print a specific page number; when omitted it falls back
 * to the total page count (preserves the original carrier-report behavior).
 */
export function drawFooter(doc: JsPdfDocument, pageLabel?: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

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
  doc.text(
    `Page ${pageLabel ?? doc.internal.getNumberOfPages()}`,
    pageWidth / 2,
    pageHeight - 9,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
}

/** Draws the footer on every page using correct sequential page numbers. */
export function drawFooterOnAllPages(doc: JsPdfDocument): void {
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page);
  }
}

export type ReportHeaderOptions = {
  title: string;
  /** Bold blue line directly under the title (e.g. carrier name). */
  accentLine?: string;
  /** Muted detail lines beneath the title/accent line. */
  metaLines?: string[];
  logo: LogoAsset | null;
  /** Height of the blue accent bar; defaults to 18 (carrier-report layout). */
  accentBarHeight?: number;
};

/**
 * Draws the shared report header: blue accent bar, large navy title, optional
 * blue accent line, muted meta lines, top-right logo (with text fallback), and
 * a blue divider. Returns the Y coordinate where body content should start.
 *
 * With `accentLine` set and two meta lines this reproduces the carrier report
 * header exactly (divider at y=42, content start y=49).
 */
export function drawReportHeader(
  doc: JsPdfDocument,
  options: ReportHeaderOptions,
): number {
  const {
    title,
    accentLine,
    metaLines = [],
    logo,
    accentBarHeight = 18,
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  const headerLeft = PAGE_MARGIN + 6;

  // Blue accent bar.
  doc.setFillColor(...PRIMARY_BLUE);
  doc.rect(PAGE_MARGIN, 13, 1.8, accentBarHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...DARK_NAVY);
  doc.text(title, headerLeft, 21);

  if (accentLine) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text(accentLine, headerLeft, 27.5);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_COLOR);
  const metaStart = accentLine ? 33 : 28;
  metaLines.forEach((line, index) => {
    doc.text(line, headerLeft, metaStart + index * 4.5);
  });

  // Logo (top-right) with preserved aspect ratio, or text fallback.
  if (logo && logo.width > 0 && logo.height > 0) {
    const maxWidth = 30;
    const maxHeight = 22;
    let logoWidth = maxWidth;
    let logoHeight = (logo.height / logo.width) * logoWidth;
    if (logoHeight > maxHeight) {
      logoHeight = maxHeight;
      logoWidth = (logo.width / logo.height) * logoHeight;
    }
    doc.addImage(
      logo.dataUrl,
      logo.format,
      pageWidth - PAGE_MARGIN - logoWidth,
      12,
      logoWidth,
      logoHeight,
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK_NAVY);
    doc.text("Dispatcher Performance", pageWidth - PAGE_MARGIN, 22, {
      align: "right",
    });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
  }

  const lastMetaY =
    metaLines.length > 0
      ? metaStart + (metaLines.length - 1) * 4.5
      : accentLine
        ? 27.5
        : 21;
  const dividerY = lastMetaY + 4.5;

  doc.setDrawColor(...PRIMARY_BLUE);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, dividerY, pageWidth - PAGE_MARGIN, dividerY);

  return dividerY + 7;
}
