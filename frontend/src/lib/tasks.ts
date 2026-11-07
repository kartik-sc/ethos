import { daysBetween, formatShortDate } from "./time";
import type { LifeArea, Task, TaskPriority } from "./types/tasks";

export const PRIORITIES: readonly TaskPriority[] = ["high", "normal", "low"];

export const LIFE_AREAS: readonly { value: LifeArea; label: string }[] = [
  { value: "academics", label: "Academics" },
  { value: "career", label: "Career" },
  { value: "personal", label: "Personal" },
  { value: "health", label: "Health" },
  { value: "social", label: "Social" },
  { value: "learning", label: "Learning" },
];

export function areaLabel(area: LifeArea): string {
  return LIFE_AREAS.find((entry) => entry.value === area)?.label ?? area;
}

export type DueTone = "overdue" | "soon" | "later";

export interface DueLabel {
  text: string;
  tone: DueTone;
}

export function describeDue(dueDate: string, today: string): DueLabel {
  const days = daysBetween(today, dueDate);
  if (days < 0) return { text: days === -1 ? "Yesterday" : `${-days}d overdue`, tone: "overdue" };
  if (days === 0) return { text: "Today", tone: "soon" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  return { text: formatShortDate(dueDate), tone: "later" };
}

export type SectionKey = "overdue" | "today" | "week" | "later" | "undated";

export interface TaskSection {
  key: SectionKey;
  label: string;
  tasks: Task[];
}

const SECTION_LABELS: Record<SectionKey, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "Next 7 days",
  later: "Later",
  undated: "No date",
};

function sectionFor(task: Task, today: string): SectionKey {
  if (task.due_date === null) return "undated";
  const days = daysBetween(today, task.due_date);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

/** Groups open tasks by deadline, keeping the API's order inside each group. */
export function groupOpenTasks(tasks: readonly Task[], today: string): TaskSection[] {
  const buckets = new Map<SectionKey, Task[]>();
  for (const task of tasks) {
    const key = sectionFor(task, today);
    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }
  return (Object.keys(SECTION_LABELS) as SectionKey[])
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, label: SECTION_LABELS[key], tasks: buckets.get(key) ?? [] }));
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
