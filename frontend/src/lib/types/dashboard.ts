// Mirrors backend/app/dashboard/schemas.py and backend/app/quotes/schemas.py.

export type DeadlineKind = "task" | "project" | "goal";

export interface Deadline {
  kind: DeadlineKind;
  id: string;
  title: string;
  date: string;
  /** Negative when overdue. */
  days: number;
  context: string | null;
}

export interface Dashboard {
  deadlines: Deadline[];
  tasks: { open: number; overdue: number; done_today: number; done_this_week: number };
}

export interface Quote {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
  last_shown_on: string | null;
}
