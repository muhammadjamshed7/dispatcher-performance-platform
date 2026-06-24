"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchOrganizationRequest } from "@/lib/api/resources";
import type { SearchResultGroup, SearchResults } from "@/lib/types";

const EMPTY_RESULTS: SearchResults = {
  carriers: [],
  dispatchers: [],
  activities: [],
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    let isCurrentSearch = true;

    const timeout = window.setTimeout(() => {
      searchOrganizationRequest(trimmedQuery)
        .then((nextResults) => {
          if (isCurrentSearch) {
            setResults(nextResults);
          }
        })
        .catch(() => {
          if (isCurrentSearch) {
            setResults(EMPTY_RESULTS);
          }
        })
        .finally(() => {
          if (isCurrentSearch) {
            setIsLoading(false);
          }
        });
    }, 300);

    return () => {
      isCurrentSearch = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const visibleResults = query.trim().length >= 2 ? results : EMPTY_RESULTS;
  const hasResults =
    visibleResults.carriers.length > 0 ||
    visibleResults.dispatchers.length > 0 ||
    visibleResults.activities.length > 0;

  function closeSearch() {
    setIsOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setIsLoading(false);
  }

  return (
    <div className="relative hidden max-w-sm flex-1 md:block">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-[#94A3B8]" />
      <Input
        placeholder="Search carriers, dispatchers, activities..."
        className="h-10 rounded-[10px] border-[#E2E8F0] bg-white pl-9 text-sm text-[#334155] placeholder:text-[#94A3B8]"
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;

          setQuery(nextQuery);
          if (nextQuery.trim().length < 2) {
            setResults(EMPTY_RESULTS);
            setIsLoading(false);
          } else {
            setIsLoading(true);
          }
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150);
        }}
      />
      {isOpen && query.trim().length >= 2 ? (
        <div className="absolute top-[calc(100%+8px)] z-50 w-full rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-lg">
          {isLoading ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              Searching...
            </p>
          ) : !hasResults ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              No matches found.
            </p>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {visibleResults.carriers.length > 0 ? (
                <SearchGroup
                  title="Carriers"
                  items={visibleResults.carriers}
                  onSelect={closeSearch}
                />
              ) : null}
              {visibleResults.dispatchers.length > 0 ? (
                <SearchGroup
                  title="Dispatchers"
                  items={visibleResults.dispatchers}
                  onSelect={closeSearch}
                />
              ) : null}
              {visibleResults.activities.length > 0 ? (
                <SearchGroup
                  title="Activities"
                  items={visibleResults.activities}
                  onSelect={closeSearch}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: SearchResultGroup[];
  onSelect: () => void;
}) {
  return (
    <div>
      <p className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="hover:bg-muted block rounded-md px-2 py-2 text-sm"
              onClick={onSelect}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
