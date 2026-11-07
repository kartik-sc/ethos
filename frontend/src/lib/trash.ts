import { formatRelativeSeconds } from "./time";

/** Matches the worker's retention: records leave Trash for good after 30 days. */
export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

export function trashDaysLeft(deletedAt: string, now: Date): number {
  const elapsed = Math.floor((now.getTime() - Date.parse(deletedAt)) / DAY_MS);
  return Math.max(0, TRASH_RETENTION_DAYS - elapsed);
}

export function trashLabel(deletedAt: string, now: Date): string {
  const left = trashDaysLeft(deletedAt, now);
  const removal = left === 0 ? "removed within the hour" : `removed in ${left}d`;
  return `deleted ${formatRelativeSeconds(new Date(deletedAt), now)} · ${removal}`;
}
