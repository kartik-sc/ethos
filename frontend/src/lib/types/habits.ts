// Mirrors backend/app/habits/schemas.py. Decimals arrive as strings ("120.00").
import type { GoalRef } from "./goals";
import type { LifeArea } from "./tasks";

export type HabitView = "active" | "trash";
export type Cadence = "daily" | "weekly";
export type Measure = "check" | "amount" | "span";
export type DayState = "met" | "partial" | "missed" | "pending" | "rest" | "future" | "inactive";

export interface DayRead {
  date: string;
  state: DayState;
  amount: string | null;
}

export interface HabitLog {
  on_date: string;
  amount: string | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface HabitSummary {
  today: DayRead;
  today_log: HabitLog | null;
  streak: number;
  streak_unit: "days" | "weeks";
  week_done: number;
  week_target: number;
  /** The last seven days, oldest first, ending today. */
  recent: DayRead[];
}

export interface Habit {
  id: string;
  title: string;
  description: string | null;
  area: LifeArea | null;
  cadence: Cadence;
  /** Monday = 0 … Sunday = 6; daily habits only. */
  weekdays: number[] | null;
  times_per_week: number | null;
  measure: Measure;
  unit: string | null;
  target_amount: string | null;
  protected: boolean;
  goal_id: string | null;
  goal: GoalRef | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  summary: HabitSummary;
}

export interface HabitInput {
  title: string;
  description?: string | null;
  area?: LifeArea | null;
  cadence: Cadence;
  weekdays?: number[] | null;
  times_per_week?: number | null;
  measure: Measure;
  unit?: string | null;
  target_amount?: number | null;
  protected?: boolean;
  goal_id?: string | null;
}

export interface LogInput {
  amount?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
}
