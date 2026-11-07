import { describe, expect, it } from "vitest";

import { delta, formatHours, niceMax, percent } from "./analytics";

describe("delta", () => {
  it("reports change neutrally", () => {
    expect(delta(8, 5)).toEqual({ text: "+3", direction: "up" });
    expect(delta(2, 5)).toEqual({ text: "−3", direction: "down" });
    expect(delta(4, 4)).toEqual({ text: "±0", direction: "same" });
  });
});

describe("percent", () => {
  it("is null when nothing was expected", () => {
    expect(percent(0, 0)).toBeNull();
    expect(percent(2, 3)).toBe(67);
  });
});

describe("formatHours", () => {
  it.each([
    [0.25, "15 min"],
    [4.4, "4 h"],
    [98, "4 days"],
  ])("%f hours reads %s", (hours, expected) => {
    expect(formatHours(hours)).toBe(expected);
  });
});

describe("niceMax", () => {
  it.each([
    [[], 1],
    [[0, 1], 1],
    [[3], 5],
    [[7, 2], 10],
    [[11], 20],
    [[60], 100],
  ])("%j tops out at %i", (values, expected) => {
    expect(niceMax(values)).toBe(expected);
  });
});
