import type { InboxItem } from "./types/inbox";

const HOUR_MS = 3_600_000;

/** The spec's ageing markers: a flag after 24 hours, a stronger one after 48. */
export type AgeTone = "fresh" | "aging" | "stale";

export function ageTone(createdAt: string, now: Date): AgeTone {
  const hours = (now.getTime() - Date.parse(createdAt)) / HOUR_MS;
  if (hours >= 48) return "stale";
  if (hours >= 24) return "aging";
  return "fresh";
}

/** Mirrors the backend: the first non-empty line, capped at 200 characters. */
export function firstLine(content: string): string {
  const line =
    content
      .split("\n")
      .find((part) => part.trim())
      ?.trim() ?? content.trim();
  return line.length <= 200 ? line : `${line.slice(0, 199)}…`;
}

export function resultHref(item: Pick<InboxItem, "outcome" | "result_id">): string | null {
  if (!item.result_id) return null;
  if (item.outcome === "task") return "/tasks";
  if (item.outcome === "project") return `/projects/${item.result_id}`;
  if (item.outcome === "goal") return `/goals/${item.result_id}`;
  return null;
}
