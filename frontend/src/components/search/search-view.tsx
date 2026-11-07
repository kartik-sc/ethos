"use client";

import { LoaderCircle, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { fieldClass } from "@/components/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearch } from "@/hooks/use-search";
import { highlight, hitHref, SEARCH_KINDS } from "@/lib/search";
import { areaLabel, LIFE_AREAS } from "@/lib/tasks";
import { formatShortDate } from "@/lib/time";
import type { SearchFilters, SearchHit, SearchKind, StatusFilter } from "@/lib/types/search";
import type { LifeArea } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function Hit({ hit, query }: { hit: SearchHit; query: string }) {
  return (
    <li>
      <Link
        href={hitHref(hit)}
        className="flex flex-col gap-1 rounded-lg px-3 py-2.5 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm">
            <Highlighted text={hit.title} query={query} />
          </span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint">{hit.status}</span>
        </span>
        {hit.snippet && (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            <Highlighted text={hit.snippet} query={query} />
          </span>
        )}
        <span className="flex flex-wrap gap-x-3 font-mono text-[0.6875rem] text-faint">
          {hit.context && <span>{hit.context}</span>}
          {hit.area && <span>{areaLabel(hit.area).toLowerCase()}</span>}
          {hit.date && <span>{formatShortDate(hit.date)}</span>}
        </span>
      </Link>
    </li>
  );
}

function KindChips({
  selected,
  onChange,
}: {
  selected: SearchKind[];
  onChange: (kinds: SearchKind[]) => void;
}) {
  return (
    <div role="group" aria-label="Record types" className="flex flex-wrap gap-1.5">
      {SEARCH_KINDS.map((kind) => {
        const on = selected.includes(kind.value);
        return (
          <button
            key={kind.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? selected.filter((value) => value !== kind.value) : [...selected, kind.value],
              )
            }
            className={cn(
              "h-7 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {kind.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({ kinds: [], area: null, status: null });
  const results = useSearch(query, filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      const url = input.trim() ? `/search?q=${encodeURIComponent(input.trim())}` : "/search";
      window.history.replaceState(window.history.state, "", url);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const grouped = SEARCH_KINDS.map((kind) => ({
    ...kind,
    hits: results.data?.hits.filter((hit) => hit.kind === kind.value) ?? [],
  })).filter((group) => group.hits.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/80 px-3.5 transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/25">
        {results.isFetching && query.trim() ? (
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-faint" />
        ) : (
          <Search aria-hidden="true" className="size-4 shrink-0 text-faint" />
        )}
        <label htmlFor="search-input" className="sr-only">
          Search
        </label>
        <input
          id="search-input"
          type="search"
          autoFocus
          autoComplete="off"
          maxLength={200}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search tasks, projects, goals, habits, notes and captures"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <KindChips
          selected={filters.kinds}
          onChange={(kinds) => setFilters({ ...filters, kinds })}
        />
        <div className="flex gap-2">
          <select
            aria-label="Area"
            value={filters.area ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, area: (event.target.value || null) as LifeArea | null })
            }
            className={cn(fieldClass, "h-7 w-auto text-xs")}
          >
            <option value="">Any area</option>
            {LIFE_AREAS.map((area) => (
              <option key={area.value} value={area.value}>
                {area.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: (event.target.value || null) as StatusFilter | null,
              })
            }
            className={cn(fieldClass, "h-7 w-auto text-xs")}
          >
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="closed">Done or processed</option>
          </select>
        </div>
      </div>

      {!query.trim() ? (
        <p className="px-1 text-sm text-muted-foreground">
          Type to search. Notes match on title, folder and tags; note text is never searched.
        </p>
      ) : results.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      ) : results.isError ? (
        <p role="alert" className="px-1 text-sm text-destructive">
          Search failed: {results.error.message}.
        </p>
      ) : grouped.length === 0 ? (
        <EmptyState icon={SearchX} title="No matches">
          Nothing matches &ldquo;{query.trim()}&rdquo; with these filters.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5" aria-live="polite">
          {grouped.map((group) => (
            <section key={group.value} aria-label={group.label}>
              <h2 className="micro-label mb-1 px-3">
                {group.label} <span className="text-faint">{group.hits.length}</span>
              </h2>
              <ul className="rounded-xl border border-border bg-card/80 p-1">
                {group.hits.map((hit) => (
                  <Hit key={`${hit.kind}-${hit.id}`} hit={hit} query={query} />
                ))}
              </ul>
            </section>
          ))}
          {results.data?.truncated && (
            <p className="px-1 text-xs text-faint">
              Showing the first 20 of each type. Refine the search to see more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
