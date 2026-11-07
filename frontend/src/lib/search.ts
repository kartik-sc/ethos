import type { SearchFilters, SearchHit, SearchKind } from "./types/search";

export const SEARCH_KINDS: readonly { value: SearchKind; label: string }[] = [
  { value: "task", label: "Tasks" },
  { value: "project", label: "Projects" },
  { value: "goal", label: "Goals" },
  { value: "habit", label: "Habits" },
  { value: "inbox", label: "Inbox" },
];

export function searchParams(query: string, filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams({ q: query.trim() });
  for (const kind of filters.kinds) params.append("kind", kind);
  if (filters.area) params.set("area", filters.area);
  if (filters.status) params.set("status", filters.status);
  return params;
}

export function hitHref(hit: Pick<SearchHit, "kind" | "id">): string {
  switch (hit.kind) {
    case "task":
      return "/tasks";
    case "habit":
      return "/habits";
    case "inbox":
      return "/inbox";
    default:
      return `/${hit.kind}s/${hit.id}`;
  }
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Splits text around case-insensitive occurrences of the query, for highlighting. */
export function highlight(text: string, query: string): Segment[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const segments: Segment[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;
  for (let index = lower.indexOf(needle); index >= 0; index = lower.indexOf(needle, cursor)) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false });
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}
