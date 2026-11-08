import { describe, expect, it } from "vitest";

import { blockPhase, durationLabel, formatSlot, formatTimeRange, unplacedReason } from "./calendar";

const TZ = "Asia/Kolkata";
// 09:00–10:30 IST on Mon 9 Nov 2026.
const block = { starts_at: "2026-11-09T03:30:00Z", ends_at: "2026-11-09T05:00:00Z" };

describe("formatTimeRange", () => {
  it("shows local 24-hour times", () => {
    expect(formatTimeRange(block.starts_at, block.ends_at, TZ)).toBe("09:00–10:30");
    expect(formatTimeRange(block.starts_at, block.ends_at, "UTC")).toBe("03:30–05:00");
  });
});

describe("formatSlot", () => {
  it("names today and tomorrow, then dates", () => {
    expect(formatSlot(block.starts_at, block.ends_at, TZ, "2026-11-09")).toBe("today 09:00–10:30");
    expect(formatSlot(block.starts_at, block.ends_at, TZ, "2026-11-08")).toBe(
      "tomorrow 09:00–10:30",
    );
    expect(formatSlot(block.starts_at, block.ends_at, TZ, "2026-11-05")).toBe(
      "Mon 9 Nov 09:00–10:30",
    );
  });

  it("uses the local date, not the UTC one", () => {
    // 01:00 IST on the 10th is still the 9th in UTC.
    const early = { starts_at: "2026-11-09T19:30:00Z", ends_at: "2026-11-09T20:30:00Z" };
    expect(formatSlot(early.starts_at, early.ends_at, TZ, "2026-11-10")).toBe("today 01:00–02:00");
  });
});

describe("blockPhase", () => {
  it.each([
    ["2026-11-09T03:00:00Z", "upcoming"],
    ["2026-11-09T03:30:00Z", "now"],
    ["2026-11-09T04:59:00Z", "now"],
    ["2026-11-09T05:00:00Z", "past"],
  ])("at %s the block is %s", (now, phase) => {
    expect(blockPhase(block, new Date(now))).toBe(phase);
  });
});

describe("durationLabel", () => {
  it.each([
    [45, "45m"],
    [60, "1h"],
    [90, "1h 30m"],
    [120, "2h"],
  ])("%d minutes → %s", (minutes, label) => {
    expect(durationLabel(minutes)).toBe(label);
  });
});

it("explains unplaced reasons and passes unknown ones through", () => {
  expect(unplacedReason("no free slot")).toBe("No free slot in this period.");
  expect(unplacedReason("something new")).toBe("something new");
});
