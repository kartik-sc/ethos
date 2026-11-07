import { describe, expect, it } from "vitest";

import {
  conflictingNote,
  deriveStatus,
  draftOf,
  isTransient,
  sameDraft,
  toSave,
} from "./note-draft";
import type { Note } from "./types/notes";

const note: Note = {
  id: "n1",
  title: "Graph theory",
  content: "BFS",
  folder_id: null,
  tags: ["cs"],
  updated_at: "",
  deleted_at: null,
  version: 3,
  created_at: "",
  links: [],
  backlinks: [],
};

describe("drafts", () => {
  it("compares content exactly and titles without surrounding spaces", () => {
    const draft = draftOf(note);
    expect(sameDraft(draft, { ...draft, title: " Graph theory " })).toBe(true);
    expect(sameDraft(draft, { ...draft, content: "BFS " })).toBe(false);
    expect(sameDraft(draft, { ...draft, tags: ["cs", "algo"] })).toBe(false);
  });

  it("builds a save from the version the editor started at", () => {
    expect(toSave({ ...draftOf(note), title: " New " }, 3)).toEqual({
      title: "New",
      content: "BFS",
      folder_id: null,
      tags: ["cs"],
      base_version: 3,
      preserve_current: false,
    });
  });
});

describe("status", () => {
  it("puts a conflict above everything else", () => {
    expect(deriveStatus({ conflict: true, saving: true, error: true, dirty: true })).toBe(
      "conflict",
    );
    expect(deriveStatus({ conflict: false, saving: false, error: false, dirty: true })).toBe(
      "dirty",
    );
    expect(deriveStatus({ conflict: false, saving: false, error: false, dirty: false })).toBe(
      "saved",
    );
  });
});

describe("errors", () => {
  it("reads the other version from a conflict body", () => {
    expect(conflictingNote({ detail: "x", current: note })).toEqual(note);
    expect(conflictingNote({ detail: "Another note already has this title" })).toBeNull();
  });

  it("retries only network and server failures", () => {
    expect(isTransient(null)).toBe(true);
    expect(isTransient(503)).toBe(true);
    expect(isTransient(409)).toBe(false);
  });
});
