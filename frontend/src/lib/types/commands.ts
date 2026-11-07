// Mirrors backend/app/commands/schemas.py.

export type CommandKind =
  "task" | "deadline" | "project" | "goal" | "habit" | "note" | "capture" | "search";
export type RecordKind = "task" | "project" | "goal" | "habit" | "note" | "inbox";

export interface Duplicate {
  kind: RecordKind;
  id: string;
  title: string;
  due: string | null;
}

export interface CommandPreview {
  kind: CommandKind;
  action: string;
  fields: { label: string; value: string }[];
  question: string | null;
  error: string | null;
  notes: string[];
  duplicates: Duplicate[];
  ready: boolean;
}

export interface CommandResult {
  kind: CommandKind;
  message: string;
  record_kind: RecordKind | null;
  record_id: string | null;
  query: string | null;
}
