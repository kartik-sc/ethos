import { describe, expect, it } from "vitest";

import { describeDue, formatMinutes, groupOpenTasks } from "./tasks";
import type { Task } from "./types/tasks";

const TODAY = "2026-11-07";

function task(title: string, due_date: string | null): Task {
  return {
    id: title,
    title,
    description: null,
    area: null,
    status: "open",
    priority: "normal",
    due_date,
    planned_minutes: null,
    project_id: null,
    project: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    completed_at: null,
    cancelled_at: null,
    deleted_at: null,
  };
}

describe("groupOpenTasks", () => {
  it("buckets by deadline in a fixed order and drops empty groups", () => {
    const sections = groupOpenTasks(
      [
        task("undated", null),
        task("in a fortnight", "2026-11-21"),
        task("last week", "2026-11-01"),
        task("today", TODAY),
        task("in seven days", "2026-11-14"),
      ],
      TODAY,
    );

    expect(sections.map((section) => [section.key, section.tasks.map((t) => t.title)])).toEqual([
      ["overdue", ["last week"]],
      ["today", ["today"]],
      ["week", ["in seven days"]],
      ["later", ["in a fortnight"]],
      ["undated", ["undated"]],
    ]);
  });

  it("returns nothing for no tasks", () => {
    expect(groupOpenTasks([], TODAY)).toEqual([]);
  });
});

describe("describeDue", () => {
  it.each([
    ["2026-11-04", "3d overdue", "overdue"],
    ["2026-11-06", "Yesterday", "overdue"],
    [TODAY, "Today", "soon"],
    ["2026-11-08", "Tomorrow", "soon"],
    ["2026-11-12", "Thu 12 Nov", "later"],
  ] as const)("%s reads as %s", (due, text, tone) => {
    expect(describeDue(due, TODAY)).toEqual({ text, tone });
  });
});

describe("formatMinutes", () => {
  it.each([
    [45, "45m"],
    [60, "1h"],
    [90, "1h 30m"],
  ])("%i minutes is %s", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});
