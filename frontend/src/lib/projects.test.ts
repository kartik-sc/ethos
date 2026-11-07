import { describe, expect, it } from "vitest";

import { completionRatio, taskSummary } from "./projects";

const withTasks = (open: number, done: number) => ({ tasks: { open, done, next_due: null } });

describe("completionRatio", () => {
  it("is null for a project without tasks, so no misleading 0% bar is drawn", () => {
    expect(completionRatio(withTasks(0, 0))).toBeNull();
  });

  it("is the done share of live tasks", () => {
    expect(completionRatio(withTasks(3, 1))).toBe(0.25);
    expect(completionRatio(withTasks(0, 2))).toBe(1);
  });
});

describe("taskSummary", () => {
  it.each([
    [0, 0, "no tasks yet"],
    [0, 4, "all 4 done"],
    [2, 1, "2 open · 1 done"],
  ])("%i open, %i done reads %s", (open, done, expected) => {
    expect(taskSummary(withTasks(open, done))).toBe(expected);
  });
});
