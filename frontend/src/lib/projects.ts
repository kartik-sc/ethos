import type { Project } from "./types/projects";

/** Share of the project's live tasks that are done; null when it has none yet. */
export function completionRatio(project: Pick<Project, "tasks">): number | null {
  const total = project.tasks.open + project.tasks.done;
  return total === 0 ? null : project.tasks.done / total;
}

export function taskSummary(project: Pick<Project, "tasks">): string {
  const { open, done } = project.tasks;
  if (open === 0 && done === 0) return "no tasks yet";
  if (open === 0) return `all ${done} done`;
  return `${open} open · ${done} done`;
}
