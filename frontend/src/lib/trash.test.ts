import { describe, expect, it } from "vitest";

import { trashDaysLeft, trashLabel } from "./trash";

const NOW = new Date("2026-11-07T12:00:00Z");

describe("trash retention", () => {
  it("counts down from thirty days", () => {
    expect(trashDaysLeft("2026-11-07T11:00:00Z", NOW)).toBe(30);
    expect(trashDaysLeft("2026-11-04T12:00:00Z", NOW)).toBe(27);
    expect(trashDaysLeft("2026-10-01T12:00:00Z", NOW)).toBe(0);
  });

  it("says when a record will be removed", () => {
    expect(trashLabel("2026-11-04T12:00:00Z", NOW)).toBe("deleted 3d ago · removed in 27d");
    expect(trashLabel("2026-10-07T11:00:00Z", NOW)).toBe(
      "deleted 31d ago · removed within the hour",
    );
  });
});
