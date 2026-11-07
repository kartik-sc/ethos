import { describe, expect, it } from "vitest";

import { MAX_IMPORT_FILES, MAX_NOTE_LENGTH, planImport } from "./notes-transfer";

describe("planImport", () => {
  it("keeps Markdown files with their paths and explains what it leaves out", () => {
    const plan = planImport([
      { path: "Vault/CS/Graphs.md", text: "# Graphs" },
      { path: "Vault/notes.MARKDOWN", text: "x" },
      { path: "Vault/photo.png", text: "" },
      { path: "Vault/huge.md", text: "x".repeat(MAX_NOTE_LENGTH + 1) },
    ]);

    expect(plan.files).toEqual([
      { path: "Vault/CS/Graphs.md", content: "# Graphs" },
      { path: "Vault/notes.MARKDOWN", content: "x" },
    ]);
    expect(plan.skipped.map((skip) => [skip.path, skip.reason])).toEqual([
      ["Vault/photo.png", "Not a Markdown file"],
      ["Vault/huge.md", "Larger than 500,000 characters"],
    ]);
  });

  it("caps one import at the backend's file limit", () => {
    const picked = Array.from({ length: MAX_IMPORT_FILES + 2 }, (_, n) => ({
      path: `${n}.md`,
      text: "",
    }));
    const plan = planImport(picked);
    expect(plan.files).toHaveLength(MAX_IMPORT_FILES);
    expect(plan.skipped).toHaveLength(2);
  });
});
