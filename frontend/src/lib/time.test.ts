import { describe, expect, it } from "vitest";

import { formatRelativeSeconds, getDayPart, hourIn } from "./time";

describe("getDayPart", () => {
  it.each([
    [4, "evening"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [23, "evening"],
  ] as const)("hour %i is %s", (hour, expected) => {
    expect(getDayPart(hour)).toBe(expected);
  });
});

describe("hourIn", () => {
  it("reads the hour in the configured timezone, not the machine's", () => {
    const utcMidnight = new Date("2026-11-07T00:00:00Z");
    expect(hourIn(utcMidnight, "Asia/Kolkata")).toBe(5);
    expect(hourIn(utcMidnight, "UTC")).toBe(0);
  });
});

describe("formatRelativeSeconds", () => {
  const base = new Date("2026-11-07T10:00:00Z");
  it("formats seconds, minutes, hours and days", () => {
    expect(formatRelativeSeconds(base, new Date("2026-11-07T10:00:12Z"))).toBe("12s ago");
    expect(formatRelativeSeconds(base, new Date("2026-11-07T10:05:00Z"))).toBe("5m ago");
    expect(formatRelativeSeconds(base, new Date("2026-11-07T12:00:00Z"))).toBe("2h ago");
    expect(formatRelativeSeconds(base, new Date("2026-11-10T09:00:00Z"))).toBe("2d ago");
  });

  it("never reports negative ages from clock skew", () => {
    expect(formatRelativeSeconds(base, new Date("2026-11-07T09:59:50Z"))).toBe("0s ago");
  });
});
