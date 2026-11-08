import { describe, expect, it } from "vitest";

import { fileBadge, formatBytes, isFileConflict } from "./files";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1536, "1.5 KB"],
    [250 * 1024, "250 KB"],
    [25 * 1024 * 1024, "25 MB"],
    [3.25 * 1024 * 1024, "3.3 MB"],
  ])("%d bytes reads %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("fileBadge", () => {
  it.each([
    ["report.pdf", "PDF"],
    ["archive.tar.gz", "GZ"],
    ["notes.markdown", "MARK"],
    ["README", ""],
    [".env", ""],
    ["trailing.", ""],
  ])("%s → %s", (name, badge) => {
    expect(fileBadge(name)).toBe(badge);
  });
});

describe("isFileConflict", () => {
  it("recognises the 409 body and nothing else", () => {
    expect(isFileConflict({ detail: "x", existing: { filename: "a.txt" } })).toBe(true);
    expect(isFileConflict({ detail: "Project not found" })).toBe(false);
    expect(isFileConflict(null)).toBe(false);
  });
});
