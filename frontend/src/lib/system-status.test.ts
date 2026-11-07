import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import { summariseSystem } from "./system-status";
import type { HealthReport } from "./types/health";

function report(overrides: Partial<HealthReport["checks"]> = {}): HealthReport {
  return {
    status: "ok",
    environment: "test",
    checked_at: "2026-11-07T10:00:00Z",
    checks: {
      database: { status: "ok", detail: null },
      worker: { status: "ok", detail: null, last_seen_at: "2026-11-07T09:59:50Z" },
      ...overrides,
    },
  };
}

describe("summariseSystem", () => {
  it("reports all systems normal when every check passes", () => {
    const summary = summariseSystem({ data: report(), error: null, isPending: false });
    expect(summary.tone).toBe("ok");
    expect(summary.label).toBe("All systems normal");
    expect(summary.signals.map((s) => s.tone)).toEqual(["ok", "ok", "ok"]);
  });

  it("names the worker when it stops reporting", () => {
    const data = {
      ...report({
        worker: { status: "degraded", detail: "No heartbeat for 4 min", last_seen_at: null },
      }),
      status: "degraded" as const,
    };
    const summary = summariseSystem({ data, error: null, isPending: false });
    expect(summary.label).toBe("Worker not reporting");
    expect(summary.signals[2]).toMatchObject({
      tone: "degraded",
      detail: "No heartbeat for 4 min",
    });
  });

  it("surfaces an unreachable database from a 503 body", () => {
    const data = {
      ...report({ database: { status: "down", detail: "Database unreachable" } }),
      status: "down" as const,
    };
    expect(summariseSystem({ data, error: null, isPending: false }).label).toBe(
      "Database unreachable",
    );
  });

  it("treats a network failure as the API being down and the rest unknown", () => {
    const summary = summariseSystem({
      data: undefined,
      error: new ApiError("API unreachable", null),
      isPending: false,
    });
    expect(summary.tone).toBe("down");
    expect(summary.signals.map((s) => s.tone)).toEqual(["down", "pending", "pending"]);
    expect(summary.signals[0].detail).toBe("No response");
  });

  it("shows a neutral checking state before the first response", () => {
    const summary = summariseSystem({ data: undefined, error: null, isPending: true });
    expect(summary.tone).toBe("pending");
    expect(summary.label).toBe("Checking systems");
  });
});
