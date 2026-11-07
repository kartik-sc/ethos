// Mirrors backend/app/notes/schemas.py.

export type LinkKind = "note" | "task" | "project" | "goal";

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface NoteSummary {
  id: string;
  title: string;
  folder_id: string | null;
  tags: string[];
  updated_at: string;
  deleted_at: string | null;
}

export interface NoteLink {
  label: string;
  kind: LinkKind;
  target_id: string | null;
  target_title: string | null;
  resolved: boolean;
}

export interface Note extends NoteSummary {
  content: string;
  /** Bumped on every save; sent back as `base_version` so stale saves are refused. */
  version: number;
  created_at: string;
  links: NoteLink[];
  backlinks: { id: string; title: string }[];
  /** Set on a save response that had to be merged with a version saved elsewhere. */
  merged?: boolean;
}

export interface NoteTree {
  folders: Folder[];
  notes: NoteSummary[];
  tags: string[];
}

export interface NoteSave {
  title: string;
  content: string;
  folder_id: string | null;
  tags: string[];
  base_version: number;
  preserve_current: boolean;
  /** The note as the editor loaded it, so a stale save can be merged three ways. */
  base: { title: string; content: string; folder_id: string | null; tags: string[] } | null;
}

export interface VersionSummary {
  id: string;
  title: string;
  saved_at: string;
  length: number;
}

export interface Version extends VersionSummary {
  content: string;
}

export interface LinkTarget {
  kind: LinkKind;
  id: string;
  title: string;
}
