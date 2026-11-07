import { describe, expect, it } from "vitest";

import {
  conflictMarkers,
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

  it("builds a save from the version the editor started at, with its base", () => {
    expect(toSave({ ...draftOf(note), title: " New " }, 3, { base: draftOf(note) })).toEqual({
      title: "New",
      content: "BFS",
      folder_id: null,
      tags: ["cs"],
      base_version: 3,
      preserve_current: false,
      base: { title: "Graph theory", content: "BFS", folder_id: null, tags: ["cs"] },
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
  it("reads the other version and the marked-up merge from a conflict body", () => {
    expect(conflictingNote({ detail: "x", current: note })).toEqual(note);
    expect(conflictMarkers({ current: note, merged_with_markers: "<<<<<<< yours" })).toBe(
      "<<<<<<< yours",
    );
    expect(conflictMarkers({ current: note, merged_with_markers: null })).toBeNull();
    expect(conflictingNote({ detail: "Another note already has this title" })).toBeNull();
  });

  it("retries only network and server failures", () => {
    expect(isTransient(null)).toBe(true);
    expect(isTransient(503)).toBe(true);
    expect(isTransient(409)).toBe(false);
  });
});
