// Mirrors backend/app/analytics/schemas.py.
import type { LifeArea } from "./tasks";

export type Period = "week" | "month";

export interface Totals {
  completed: number;
  cancelled: number;
  created: number;
  deadlines_met: number;
  deadlines_missed: number;
  habit_done: number;
  habit_expected: number;
  captured: number;
  processed: number;
  notes_edited: number;
}

export interface AnalyticsReport {
  period: Period;
  offset: number;
  label: string;
  start: string;
  end: string;
  is_current: boolean;
  totals: Totals;
  previous: Totals;
  completed_by_day: { date: string; count: number }[];
  completed_by_area: { area: LifeArea | null; count: number }[];
  /** `open`: still possible today or this week, not counted as missed. */
  habits: { id: string; title: string; done: number; expected: number; open: number }[];
  inbox_median_hours: number | null;
  overdue_now: number;
  inbox_open: number;
  observations: string[];
}
