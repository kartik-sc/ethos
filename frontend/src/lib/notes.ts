import type { Folder, LinkKind, NoteSummary } from "./types/notes";

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  notes: NoteSummary[];
}

export interface LibraryTree {
  folders: FolderNode[];
  /** Notes outside any folder. */
  notes: NoteSummary[];
}

/** Nests folders under their parents; an optional tag narrows the notes shown. */
export function buildLibrary(
  folders: readonly Folder[],
  notes: readonly NoteSummary[],
  tag: string | null = null,
): LibraryTree {
  const visible = tag ? notes.filter((note) => note.tags.includes(tag)) : notes;
  const nodes = new Map<string, FolderNode>(
    folders.map((folder) => [folder.id, { folder, children: [], notes: [] }]),
  );
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.folder.parent_id ? nodes.get(node.folder.parent_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const loose: NoteSummary[] = [];
  for (const note of visible) {
    const node = note.folder_id ? nodes.get(note.folder_id) : undefined;
    (node ? node.notes : loose).push(note);
  }
  return { folders: roots, notes: loose };
}

/** Path like "CS / Algorithms" for a folder, for pickers. */
export function folderPath(folders: readonly Folder[], id: string): string {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const parts: string[] = [];
  for (
    let folder = byId.get(id);
    folder;
    folder = folder.parent_id ? byId.get(folder.parent_id) : undefined
  ) {
    parts.unshift(folder.name);
    if (parts.length > 32) break;
  }
  return parts.join(" / ");
}

/** "Untitled", then "Untitled 2", "Untitled 3"… avoiding titles in use (case-insensitive). */
export function untitled(existing: readonly string[]): string {
  const taken = new Set(existing.map((title) => title.toLowerCase()));
  if (!taken.has("untitled")) return "Untitled";
  for (let n = 2; ; n++) if (!taken.has(`untitled ${n}`)) return `Untitled ${n}`;
}

export interface WikiQuery {
  /** Index just after the opening `[[`. */
  start: number;
  query: string;
}

/** The text typed after an unclosed `[[` before the caret, if the caret is inside one. */
export function wikiQueryAt(text: string, caret: number): WikiQuery | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf("[[");
  if (open < 0) return null;
  const query = before.slice(open + 2);
  if (query.includes("]]") || query.includes("\n") || query.includes("[") || query.length > 220) {
    return null;
  }
  return { start: open + 2, query };
}

/** Replaces the typed query with the chosen title and closes the link. */
export function insertWikiLink(
  text: string,
  wiki: WikiQuery,
  caret: number,
  title: string,
  kind: LinkKind,
): { text: string; caret: number } {
  const label = kind === "note" ? title : `${kind}:${title}`;
  const after = text.slice(caret);
  const closing = after.startsWith("]]") ? "" : "]]";
  const next = `${text.slice(0, wiki.start)}${label}${closing}${after}`;
  return { text: next, caret: wiki.start + label.length + 2 };
}

/** Splits a typed tag field on commas or spaces, dropping blanks and leading #. */
export function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#+/, "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function markdownFilename(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "note";
  return `${safe}.md`;
}
