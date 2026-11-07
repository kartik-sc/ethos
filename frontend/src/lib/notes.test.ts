import { describe, expect, it } from "vitest";

import {
  buildLibrary,
  folderPath,
  insertWikiLink,
  markdownFilename,
  parseTags,
  untitled,
  wikiQueryAt,
} from "./notes";
import type { Folder, NoteSummary } from "./types/notes";

const folders: Folder[] = [
  { id: "cs", name: "CS", parent_id: null },
  { id: "algo", name: "Algorithms", parent_id: "cs" },
];

function note(id: string, folder_id: string | null, tags: string[] = []): NoteSummary {
  return { id, title: id, folder_id, tags, updated_at: "", deleted_at: null };
}

describe("buildLibrary", () => {
  it("nests folders and places notes", () => {
    const tree = buildLibrary(folders, [note("sorting", "algo"), note("loose", null)]);
    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0].children[0].notes.map((n) => n.id)).toEqual(["sorting"]);
    expect(tree.notes.map((n) => n.id)).toEqual(["loose"]);
  });

  it("filters notes by tag but keeps folders", () => {
    const tree = buildLibrary(folders, [note("a", "cs", ["dbms"]), note("b", "cs")], "dbms");
    expect(tree.folders[0].notes.map((n) => n.id)).toEqual(["a"]);
  });
});

describe("folderPath", () => {
  it("joins ancestors", () => {
    expect(folderPath(folders, "algo")).toBe("CS / Algorithms");
  });
});

describe("untitled", () => {
  it("finds the next free title", () => {
    expect(untitled([])).toBe("Untitled");
    expect(untitled(["untitled", "Untitled 2"])).toBe("Untitled 3");
  });
});

describe("wiki-link autocomplete", () => {
  it("detects an open link before the caret", () => {
    const text = "See [[Gra";
    expect(wikiQueryAt(text, text.length)).toEqual({ start: 6, query: "Gra" });
  });

  it("ignores closed links and line breaks", () => {
    expect(wikiQueryAt("[[Done]] more", 13)).toBeNull();
    expect(wikiQueryAt("[[a\nb", 5)).toBeNull();
  });

  it("inserts the title, closes the link and moves the caret past it", () => {
    const text = "See [[Gra and more";
    const wiki = { start: 6, query: "Gra" };
    expect(insertWikiLink(text, wiki, 9, "Graph theory", "note")).toEqual({
      text: "See [[Graph theory]] and more",
      caret: 20,
    });
  });

  it("prefixes record links and reuses existing closing brackets", () => {
    const result = insertWikiLink("[[Rev]]", { start: 2, query: "Rev" }, 5, "Revise OS", "task");
    expect(result.text).toBe("[[task:Revise OS]]");
  });
});

describe("parseTags and filenames", () => {
  it("splits on commas and spaces", () => {
    expect(parseTags("#DBMS, cs  cs")).toEqual(["dbms", "cs"]);
  });

  it("makes safe filenames", () => {
    expect(markdownFilename("A/B: notes?")).toBe("A-B- notes-.md");
  });
});
