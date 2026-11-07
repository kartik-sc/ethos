// Mirrors backend/app/projects/schemas.py.
import type { GoalRef } from "./goals";
import type { LifeArea } from "./tasks";

export type ProjectView = "active" | "trash";

export interface ProjectRef {
  id: string;
  title: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  area: LifeArea | null;
  due_date: string | null;
  goal_id: string | null;
  goal: GoalRef | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tasks: { open: number; done: number; next_due: string | null };
}

export interface ProjectCreate {
  title: string;
  description?: string | null;
  area?: LifeArea | null;
  due_date?: string | null;
  goal_id?: string | null;
}

export type ProjectUpdate = Partial<ProjectCreate>;
