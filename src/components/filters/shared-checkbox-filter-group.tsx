"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SharedFilterOption = {
  value: string;
  label: string;
};

type SharedCheckboxFilterGroupProps = {
  title: string;
  searchPlaceholder: string;
  options: SharedFilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  className?: string;
};

export function SharedCheckboxFilterGroup({
  title,
  searchPlaceholder,
  options,
  selectedValues,
  onChange,
  className,
}: SharedCheckboxFilterGroupProps) {
  const [query, setQuery] = useState("");

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalized),
    );
  }, [options, query]);

  function toggleValue(value: string) {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }

    onChange([...selectedValues, value]);
  }

  function selectAllVisible() {
    const visibleValues = visibleOptions.map((option) => option.value);
    onChange([...new Set([...selectedValues, ...visibleValues])]);
  }

  function clearSection() {
    onChange([]);
    setQuery("");
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            onClick={selectAllVisible}
          >
            Select All
          </button>
          <span className="text-[#CBD5E1]">|</span>
          <button
            type="button"
            className="font-medium text-[#64748B] hover:text-[#334155]"
            onClick={clearSection}
          >
            Clear
          </button>
        </div>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-9 rounded-[10px] border-[#E2E8F0] bg-[#F8FAFC] text-sm"
      />

      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {visibleOptions.length === 0 ? (
          <p className="py-3 text-center text-xs text-[#94A3B8]">
            No matches found
          </p>
        ) : (
          visibleOptions.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#F8FAFC]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(option.value)}
                  className="size-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]/30"
                />
                <span className="truncate text-sm text-[#334155]">
                  {option.label}
                </span>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}
