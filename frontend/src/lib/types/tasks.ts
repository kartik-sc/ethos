// Mirrors backend/app/tasks/schemas.py.

export type TaskStatus = "open" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";
export type LifeArea = "academics" | "career" | "personal" | "health" | "social" | "learning";
export type TaskView = "open" | "done" | "trash";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  area: LifeArea | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date (YYYY-MM-DD) in the owner's timezone. */
  due_date: string | null;
  planned_minutes: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  deleted_at: string | null;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  area?: LifeArea | null;
  priority?: TaskPriority;
  due_date?: string | null;
  planned_minutes?: number | null;
}

export type TaskUpdate = Partial<TaskCreate> & { status?: TaskStatus };

export interface NextAction {
  task: Task | null;
  reason: string | null;
  overridden: boolean;
}
