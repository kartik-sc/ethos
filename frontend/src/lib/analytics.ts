import type { Period } from "./types/analytics";

export interface Delta {
  /** "+3", "−2" or "±0". */
  text: string;
  direction: "up" | "down" | "same";
}

/** A change shown without judgement: more is not "good" and fewer is not "bad". */
export function delta(current: number, previous: number): Delta {
  const difference = current - previous;
  if (difference === 0) return { text: "±0", direction: "same" };
  return difference > 0
    ? { text: `+${difference}`, direction: "up" }
    : { text: `−${-difference}`, direction: "down" };
}

/** Whole-number percentage, or null when nothing was expected. */
export function percent(done: number, expected: number): number | null {
  return expected === 0 ? null : Math.round((done / expected) * 100);
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function previousLabel(period: Period): string {
  return period === "week" ? "last week" : "last month";
}

/** A rounded-up axis maximum so the tallest bar never touches the top: 1, 2, 5, 10, 20… */
export function niceMax(values: readonly number[]): number {
  const max = Math.max(0, ...values);
  if (max <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) {
    if (max <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}
