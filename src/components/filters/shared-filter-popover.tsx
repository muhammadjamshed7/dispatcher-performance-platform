"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  SharedCheckboxFilterGroup,
  type SharedFilterOption,
} from "./shared-checkbox-filter-group";
import {
  SharedDateRangeFilter,
  type SharedDateRangeOption,
} from "./shared-date-range-filter";

export type SharedFilterGroup = {
  id: string;
  title: string;
  searchPlaceholder: string;
  options: SharedFilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
};

export type SharedDateRangeConfig = {
  name: string;
  value: string;
  options: SharedDateRangeOption[];
  onChange: (value: string) => void;
  customDateFrom?: string;
  customDateTo?: string;
  onCustomDateFromChange?: (value: string) => void;
  onCustomDateToChange?: (value: string) => void;
};

type SharedFilterPopoverProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  title: string;
  description: string;
  dateRange?: SharedDateRangeConfig;
  children?: ReactNode;
  groups: SharedFilterGroup[];
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
  className?: string;
};

export function SharedFilterPopover({
  open,
  anchorRef,
  title,
  description,
  dateRange,
  children,
  groups,
  onApply,
  onReset,
  onClose,
  className,
}: SharedFilterPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 80, right: 16 });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const anchorRect = anchorRef.current?.getBoundingClientRect();
    setPosition({
      top: anchorRect ? anchorRect.bottom + 8 : 80,
      right: anchorRect
        ? Math.max(16, window.innerWidth - anchorRect.right)
        : 16,
    });
  }, [anchorRef, groups, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: position.top, right: position.right }}
      className={cn(
        "fixed z-50 flex max-h-[70vh] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)]",
        className,
      )}
    >
      <div className="border-b border-[#F1F5F9] px-5 py-4">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        <p className="mt-1 text-xs text-[#64748B]">{description}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {dateRange ? (
          <>
            <SharedDateRangeFilter {...dateRange} />
            {children || groups.length > 0 ? (
              <Separator className="bg-[#F1F5F9]" />
            ) : null}
          </>
        ) : null}

        {children}

        {children && groups.length > 0 ? (
          <Separator className="bg-[#F1F5F9]" />
        ) : null}

        {groups.map((group, index) => (
          <div key={group.id}>
            <SharedCheckboxFilterGroup
              title={group.title}
              searchPlaceholder={group.searchPlaceholder}
              options={group.options}
              selectedValues={group.selectedValues}
              onChange={group.onChange}
            />
            {index < groups.length - 1 ? (
              <Separator className="mt-5 bg-[#F1F5F9]" />
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#F1F5F9] px-5 py-4">
        <Button
          type="button"
          variant="ghost"
          className="text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#334155]"
          onClick={onReset}
        >
          Reset All
        </Button>
        <Button
          type="button"
          className="rounded-[10px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </div>
    </div>,
    document.body,
  );
}
