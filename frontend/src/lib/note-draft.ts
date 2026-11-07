import type { Note, NoteSave } from "./types/notes";

export interface Draft {
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
}

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

export const AUTOSAVE_MS = 2 * 60_000;
/** Back-off for failed writes; the in-memory draft is never dropped. */
export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

export function draftOf(note: Note): Draft {
  return { title: note.title, content: note.content, folderId: note.folder_id, tags: note.tags };
}

export function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.content === b.content &&
    a.folderId === b.folderId &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}

export function toSave(
  draft: Draft,
  baseVersion: number,
  options: { preserveCurrent?: boolean; base?: Draft } = {},
): NoteSave {
  return {
    title: draft.title.trim(),
    content: draft.content,
    folder_id: draft.folderId,
    tags: draft.tags,
    base_version: baseVersion,
    preserve_current: options.preserveCurrent ?? false,
    base: options.base
      ? {
          title: options.base.title.trim(),
          content: options.base.content,
          folder_id: options.base.folderId,
          tags: options.base.tags,
        }
      : null,
  };
}

export function deriveStatus(state: {
  conflict: boolean;
  saving: boolean;
  error: boolean;
  dirty: boolean;
}): SaveStatus {
  if (state.conflict) return "conflict";
  if (state.saving) return "saving";
  if (state.error) return "error";
  return state.dirty ? "dirty" : "saved";
}

/** A 409 from PUT /notes/{id} that carries the version saved elsewhere. */
export function conflictingNote(body: unknown): Note | null {
  if (body && typeof body === "object" && "current" in body) {
    const current = (body as { current: unknown }).current;
    if (current && typeof current === "object" && "version" in current) return current as Note;
  }
  return null;
}

/** Both sides of each overlapping edit between markers, from a 409 the server couldn't merge. */
export function conflictMarkers(body: unknown): string | null {
  if (body && typeof body === "object" && "merged_with_markers" in body) {
    const markers = (body as { merged_with_markers: unknown }).merged_with_markers;
    if (typeof markers === "string") return markers;
  }
  return null;
}

export const MARKER = "<<<<<<< yours";

/** Network failures and server errors are worth retrying; validation errors are not. */
export function isTransient(status: number | null): boolean {
  return status === null || status >= 500;
}
