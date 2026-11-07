import type { Deadline } from "./types/dashboard";

export const RADAR_WINDOWS = [7, 14, 30] as const;
export type RadarWindow = (typeof RADAR_WINDOWS)[number];

/** Overdue items always stay visible; the rest must fall inside the window. */
export function inWindow(deadlines: readonly Deadline[], window: RadarWindow): Deadline[] {
  return deadlines.filter((deadline) => deadline.days <= window);
}

export interface Placed {
  deadline: Deadline;
  /** Horizontal position, 0–1 across the timeline; overdue items sit in their own band. */
  x: number;
  /** Stack index among deadlines on the same day. */
  lane: number;
}

export function placeDeadlines(deadlines: readonly Deadline[], window: RadarWindow): Placed[] {
  const lanes = new Map<number, number>();
  return inWindow(deadlines, window).map((deadline) => {
    const day = Math.max(deadline.days, -1);
    const lane = lanes.get(day) ?? 0;
    lanes.set(day, lane + 1);
    return { deadline, x: day < 0 ? -1 : day / window, lane };
  });
}

export function describeDays(days: number): string {
  if (days < -1) return `${-days}d overdue`;
  if (days === -1) return "1d overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

export function deadlineHref(deadline: Pick<Deadline, "kind" | "id">): string {
  if (deadline.kind === "task") return "/tasks";
  return `/${deadline.kind}s/${deadline.id}`;
}
