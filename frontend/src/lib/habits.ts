import type { Habit } from "./types/habits";

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export function describeSchedule(habit: Pick<Habit, "cadence" | "weekdays" | "times_per_week">) {
  if (habit.cadence === "weekly") return `${habit.times_per_week ?? 0}× a week`;
  const days = [...(habit.weekdays ?? [])].sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.join() === "0,1,2,3,4") return "Weekdays";
  if (days.join() === "5,6") return "Weekends";
  return days.map((day) => SHORT_DAYS[day]).join(", ");
}

/** "120", "7.5", "82.25": drop the API's trailing zeros. */
export function formatAmount(value: string | number): string {
  return String(Number(value));
}

export function describeTarget(habit: Pick<Habit, "measure" | "unit" | "target_amount">) {
  if (habit.measure === "check" || habit.target_amount === null) return null;
  return `${formatAmount(habit.target_amount)} ${habit.unit ?? ""}`.trim();
}

/** Whether the habit still asks for something today (shown on Home). */
export function isDueToday(habit: Habit): boolean {
  const { today, week_done, week_target } = habit.summary;
  if (habit.cadence === "weekly") return today.state !== "met" && week_done < week_target;
  return today.state === "pending" || today.state === "partial";
}
