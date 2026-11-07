// Mirrors backend/app/inbox/schemas.py.

export type InboxView = "open" | "processed";
export type InboxOutcome = "task" | "project" | "goal" | "done" | "dismissed";
export type ConvertKind = "task" | "project" | "goal";

export interface InboxItem {
  id: string;
  content: string;
  source: string;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  outcome: InboxOutcome | null;
  /** The task, project or goal the item became. */
  result_id: string | null;
}

export interface ConvertRequest {
  kind: ConvertKind;
  title?: string | null;
  due_date?: string | null;
}
