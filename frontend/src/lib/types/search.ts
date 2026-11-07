// Mirrors backend/app/search/schemas.py.
import type { LifeArea } from "./tasks";

export type SearchKind = "task" | "project" | "goal" | "habit" | "inbox";
export type StatusFilter = "open" | "closed";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  area: LifeArea | null;
  status: string;
  date: string | null;
  context: string | null;
}

export interface SearchResults {
  query: string;
  hits: SearchHit[];
  truncated: boolean;
}

export interface SearchFilters {
  kinds: SearchKind[];
  area: LifeArea | null;
  status: StatusFilter | null;
}
