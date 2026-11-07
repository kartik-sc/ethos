import { describe, expect, it } from "vitest";

import type { Task } from "@/lib/types/tasks";

import { diffDraft } from "./task-editor";

const task: Task = {
  id: "t1",
  title: "Revise OS",
  description: null,
  area: "academics",
  status: "open",
  priority: "normal",
  due_date: "2026-11-10",
  planned_minutes: null,
  project_id: null,
  project: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  completed_at: null,
  cancelled_at: null,
  deleted_at: null,
};

const unchanged = {
  title: "Revise OS",
  description: "",
  due_date: "2026-11-10",
  priority: "normal" as const,
  area: "academics" as const,
  planned_minutes: "",
  project_id: "",
};

describe("diffDraft", () => {
  it("sends nothing when the draft matches the task", () => {
    expect(diffDraft(task, unchanged)).toEqual({});
  });

  it("sends only changed fields, mapping blanks to null", () => {
    expect(
      diffDraft(task, {
        ...unchanged,
        title: " Revise OS ch. 4 ",
        due_date: "",
        planned_minutes: "45",
      }),
    ).toEqual({ title: "Revise OS ch. 4", due_date: null, planned_minutes: 45 });
  });

  it("treats whitespace-only notes as no notes", () => {
    expect(diffDraft(task, { ...unchanged, description: "   " })).toEqual({});
  });
});
