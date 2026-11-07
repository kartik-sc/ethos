// Mirrors backend/app/goals/schemas.py.
import type { LifeArea } from "./tasks";

export type GoalView = "active" | "trash";

export interface GoalRef {
  id: string;
  title: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  area: LifeArea | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Tasks linked directly or through a linked project; cancelled tasks excluded. */
  progress: { done: number; total: number; projects: number };
}

export interface GoalCreate {
  title: string;
  description?: string | null;
  area?: LifeArea | null;
  target_date?: string | null;
}

export type GoalUpdate = Partial<GoalCreate>;
