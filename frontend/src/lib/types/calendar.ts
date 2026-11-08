// Mirrors backend/app/calendar/schemas.py.
export type BlockKind = "task" | "habit" | "event";
export type BlockStatus = "scheduled" | "done" | "missed";
export type SyncState = "synced" | "pending" | "failed";

export interface CalendarBlock {
  id: string;
  kind: BlockKind;
  title: string;
  starts_at: string;
  ends_at: string;
  task_id: string | null;
  habit_id: string | null;
  status: BlockStatus;
  fixed: boolean;
  recovers_id: string | null;
  sync: SyncState;
}

export interface CalendarStatus {
  connected: boolean;
  pending: number;
}

export interface PlannedBlock {
  task_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

export interface UnplacedTask {
  task_id: string;
  title: string;
  minutes: number;
  due_date: string | null;
  reason: string;
}

export interface PlanResult {
  applied: boolean;
  placed: PlannedBlock[];
  unplaced: UnplacedTask[];
}
