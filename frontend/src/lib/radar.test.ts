import { describe, expect, it } from "vitest";

import { deadlineHref, describeDays, inWindow, placeDeadlines } from "./radar";
import type { Deadline } from "./types/dashboard";

function deadline(title: string, days: number, kind: Deadline["kind"] = "task"): Deadline {
  return { kind, id: title, title, date: "2026-11-07", days, context: null };
}

const items = [deadline("late", -3), deadline("soon", 2), deadline("mid", 10), deadline("far", 25)];

describe("inWindow", () => {
  it("keeps overdue items and those within the window", () => {
    expect(inWindow(items, 7).map((item) => item.title)).toEqual(["late", "soon"]);
    expect(inWindow(items, 30)).toHaveLength(4);
  });
});

describe("placeDeadlines", () => {
  it("puts overdue items in their own band and scales the rest", () => {
    const placed = placeDeadlines(items, 14);
    expect(placed.map((item) => [item.deadline.title, item.x])).toEqual([
      ["late", -1],
      ["soon", 2 / 14],
      ["mid", 10 / 14],
    ]);
  });

  it("stacks deadlines that share a day", () => {
    const placed = placeDeadlines(
      [deadline("a", 3), deadline("b", 3), deadline("c", -1), deadline("d", -5)],
      7,
    );
    expect(placed.map((item) => item.lane)).toEqual([0, 1, 0, 1]);
  });
});

describe("labels and links", () => {
  it.each([
    [-4, "4d overdue"],
    [-1, "1d overdue"],
    [0, "today"],
    [1, "tomorrow"],
    [9, "in 9d"],
  ])("%i days reads %s", (days, expected) => {
    expect(describeDays(days)).toBe(expected);
  });

  it("links to the record's page", () => {
    expect(deadlineHref({ kind: "project", id: "p1" })).toBe("/projects/p1");
    expect(deadlineHref({ kind: "task", id: "t1" })).toBe("/tasks");
  });
});
