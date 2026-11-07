import { describe, expect, it } from "vitest";

import { describeSchedule, describeTarget, formatAmount } from "./habits";

describe("describeSchedule", () => {
  it.each([
    [{ cadence: "daily", weekdays: [0, 1, 2, 3, 4, 5, 6], times_per_week: null }, "Every day"],
    [{ cadence: "daily", weekdays: [4, 0, 1, 2, 3], times_per_week: null }, "Weekdays"],
    [{ cadence: "daily", weekdays: [5, 6], times_per_week: null }, "Weekends"],
    [{ cadence: "daily", weekdays: [0, 2, 4], times_per_week: null }, "Mon, Wed, Fri"],
    [{ cadence: "weekly", weekdays: null, times_per_week: 3 }, "3× a week"],
  ] as const)("%o reads %s", (habit, expected) => {
    expect(
      describeSchedule({ ...habit, weekdays: habit.weekdays ? [...habit.weekdays] : null }),
    ).toBe(expected);
  });
});

describe("amounts", () => {
  it("drops trailing zeros from API decimals", () => {
    expect(formatAmount("120.00")).toBe("120");
    expect(formatAmount("7.50")).toBe("7.5");
  });

  it("describes targets only when there is one", () => {
    expect(describeTarget({ measure: "amount", unit: "min", target_amount: "120.00" })).toBe(
      "120 min",
    );
    expect(describeTarget({ measure: "check", unit: null, target_amount: null })).toBeNull();
  });
});
