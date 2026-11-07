import type { Goal } from "./types/goals";

type Progress = Goal["progress"];

/** Done share of counted tasks; null when nothing is linked yet, so no fake 0% is shown. */
export function goalRatio(progress: Progress): number | null {
  return progress.total === 0 ? null : progress.done / progress.total;
}

export function goalSummary(progress: Progress): string {
  const parts: string[] = [];
  parts.push(
    progress.total === 0 ? "no tasks linked" : `${progress.done} of ${progress.total} tasks`,
  );
  if (progress.projects > 0) {
    parts.push(`${progress.projects} project${progress.projects === 1 ? "" : "s"}`);
  }
  if (progress.habits > 0) {
    parts.push(`${progress.habits} habit${progress.habits === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
