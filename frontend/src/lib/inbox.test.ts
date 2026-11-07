import { describe, expect, it } from "vitest";

import { ageTone, firstLine, resultHref } from "./inbox";

const NOW = new Date("2026-11-07T12:00:00Z");

describe("ageTone", () => {
  it.each([
    ["2026-11-07T00:00:00Z", "fresh"],
    ["2026-11-06T12:00:00Z", "aging"],
    ["2026-11-05T11:00:00Z", "stale"],
  ] as const)("captured at %s is %s", (createdAt, tone) => {
    expect(ageTone(createdAt, NOW)).toBe(tone);
  });
});

describe("firstLine", () => {
  it("skips blank lines and trims", () => {
    expect(firstLine("\n  Buy paint  \nwhite")).toBe("Buy paint");
  });

  it("caps long lines like the backend", () => {
    expect(firstLine("x".repeat(250))).toHaveLength(200);
  });
});

describe("resultHref", () => {
  it("links to what the item became", () => {
    expect(resultHref({ outcome: "project", result_id: "p1" })).toBe("/projects/p1");
    expect(resultHref({ outcome: "dismissed", result_id: null })).toBeNull();
  });
});
