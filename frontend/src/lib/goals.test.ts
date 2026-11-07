import { describe, expect, it } from "vitest";

import { goalRatio, goalSummary } from "./goals";

describe("goalRatio", () => {
  it("is null with nothing linked", () => {
    expect(goalRatio({ done: 0, total: 0, projects: 2 })).toBeNull();
  });

  it("is the done share of counted tasks", () => {
    expect(goalRatio({ done: 3, total: 12, projects: 0 })).toBe(0.25);
  });
});

describe("goalSummary", () => {
  it.each([
    [{ done: 0, total: 0, projects: 0 }, "no tasks linked"],
    [{ done: 2, total: 5, projects: 1 }, "2 of 5 tasks · 1 project"],
    [{ done: 0, total: 3, projects: 2 }, "0 of 3 tasks · 2 projects"],
  ])("%o reads %s", (progress, expected) => {
    expect(goalSummary(progress)).toBe(expected);
  });
});
