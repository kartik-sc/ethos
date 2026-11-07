import { describe, expect, it } from "vitest";

import { opensAfterRun, resultHref, suggestions, wantsPreview } from "./commands";
import type { CommandResult } from "./types/commands";

function result(overrides: Partial<CommandResult>): CommandResult {
  return {
    kind: "task",
    message: "",
    record_kind: "task",
    record_id: "t1",
    query: null,
    ...overrides,
  };
}

describe("suggestions", () => {
  it("lists commands and pages when empty", () => {
    const items = suggestions("");
    expect(items[0]).toMatchObject({ type: "command", command: { name: "task" } });
    expect(items.some((item) => item.type === "navigate")).toBe(true);
  });

  it("filters commands by the typed name", () => {
    expect(suggestions("/p").map((item) => item.type === "command" && item.command.name)).toEqual([
      "project",
    ]);
  });

  it("offers capture first for plain text, then search and matching pages", () => {
    const items = suggestions("hab");
    expect(items.map((item) => item.type)).toEqual(["capture", "search", "navigate"]);
  });
});

describe("wantsPreview", () => {
  it("needs a command and some arguments", () => {
    expect(wantsPreview("/task")).toBe(false);
    expect(wantsPreview("/task ")).toBe(false);
    expect(wantsPreview("/task Write")).toBe(true);
    expect(wantsPreview("write report")).toBe(false);
  });
});

describe("results", () => {
  it("links to what was created and opens notes and searches", () => {
    expect(resultHref(result({ record_kind: "project", record_id: "p1" }))).toBe("/projects/p1");
    const search = result({ kind: "search", record_kind: null, record_id: null, query: "a b" });
    expect(resultHref(search)).toBe("/search?q=a%20b");
    expect(opensAfterRun(search)).toBe(true);
    expect(opensAfterRun(result({}))).toBe(false);
  });
});
