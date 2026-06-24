"use client";

import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

type FinanceExportButtonsProps = {
  onExportCsv: () => void | Promise<void>;
  onExportPdf: () => void;
  isExporting?: boolean;
};

export function FinanceExportButtons({
  onExportCsv,
  onExportPdf,
  isExporting = false,
}: FinanceExportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isExporting}
        onClick={() => void onExportCsv()}
      >
        <Download className="size-4" />
        Download CSV
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onExportPdf}>
        <FileText className="size-4" />
        Download PDF
      </Button>
    </div>
  );
}
