import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiGet, apiSend } from "@/lib/api";
import {
  AUTOSAVE_MS,
  conflictingNote,
  conflictMarkers,
  type Draft,
  deriveStatus,
  draftOf,
  isTransient,
  RETRY_DELAYS_MS,
  sameDraft,
  type SaveStatus,
  toSave,
} from "@/lib/note-draft";
import type { Note } from "@/lib/types/notes";

import { noteKeys } from "./use-notes";

interface SaveOptions {
  /** Save this draft instead of the current one (e.g. a restored version). */
  draft?: Draft;
  /** Overwrite after a conflict: the replaced version keeps its own history entry. */
  overwrite?: Note;
}

/** What the draft was last in sync with: the common ancestor for the next save. */
interface Base {
  draft: Draft;
  version: number;
}

export interface Conflict {
  theirs: Note;
  /** Both sides of each overlapping edit between markers, when the text itself conflicted. */
  markers: string | null;
}

/**
 * Owns one open note: the draft, its save status and every way it gets written —
 * explicit save, the two-minute autosave, retries, merges, and a last save on the way out.
 */
export function useNoteDraft(initial: Note) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(initial);
  const [base, setBase] = useState<Base>(() => ({
    draft: draftOf(initial),
    version: initial.version,
  }));
  const [draft, setDraft] = useState(() => draftOf(initial));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [mergedAt, setMergedAt] = useState<Date | null>(null);

  const dirty = !sameDraft(draft, base.draft);
  const status: SaveStatus = deriveStatus({
    conflict: conflict !== null,
    saving,
    error: error !== null,
    dirty,
  });

  // Timers and the unmount save read the latest state through this ref.
  const latest = useRef({ draft, base, saved, dirty, saving, conflict });
  useEffect(() => {
    latest.current = { draft, base, saved, dirty, saving, conflict };
  });
  const retry = useRef<{ attempt: number; timer?: ReturnType<typeof setTimeout> }>({ attempt: 0 });
  // Retries call the latest save through a ref instead of the callback capturing itself.
  const saveLater = useRef<(() => Promise<void>) | null>(null);

  const save = useCallback(
    async (options: SaveOptions = {}) => {
      const current = latest.current;
      if (current.saving) return;
      const toWrite = options.draft ?? current.draft;
      if (!toWrite.title.trim()) {
        setError("A note needs a title");
        return;
      }
      clearTimeout(retry.current.timer);
      setSaving(true);
      try {
        const body = options.overwrite
          ? toSave(toWrite, options.overwrite.version, { preserveCurrent: true })
          : toSave(toWrite, current.base.version, { base: current.base.draft });
        const result = await apiSend<Note>("PUT", `/notes/${current.saved.id}`, body);
        const typedSince = !sameDraft(latest.current.draft, toWrite);

        retry.current.attempt = 0;
        setSaved(result);
        setConflict(null);
        setError(null);
        setSavedAt(new Date());
        if (result.merged && typedSince) {
          // The server merged in changes from elsewhere, but typing continued meanwhile. Keep
          // what was sent as the base, so the next save merges the new typing on top of the
          // merged note instead of quietly undoing the other side's changes.
          setBase({ draft: toWrite, version: result.version - 1 });
        } else {
          setBase({ draft: draftOf(result), version: result.version });
          if (result.merged) setDraft(draftOf(result));
        }
        if (result.merged) setMergedAt(new Date());
        queryClient.setQueryData(noteKeys.note(result.id), { ...result, merged: false });
        void queryClient.invalidateQueries({ queryKey: noteKeys.tree });
        void queryClient.invalidateQueries({ queryKey: noteKeys.versions(result.id) });
      } catch (caught) {
        const apiError = caught instanceof ApiError ? caught : new ApiError("Save failed", null);
        const theirs = apiError.status === 409 ? conflictingNote(apiError.body) : null;
        if (theirs) {
          setConflict({ theirs, markers: conflictMarkers(apiError.body) });
        } else {
          setError(apiError.message);
          if (isTransient(apiError.status)) {
            const delay =
              RETRY_DELAYS_MS[Math.min(retry.current.attempt, RETRY_DELAYS_MS.length - 1)];
            retry.current.attempt += 1;
            retry.current.timer = setTimeout(() => void saveLater.current?.(), delay);
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [queryClient],
  );

  useEffect(() => {
    saveLater.current = () => save();
  }, [save]);

  // Two-minute autosave, only while there is something to save and nothing blocking it.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = latest.current;
      if (current.dirty && !current.saving && !current.conflict) void save();
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [save]);

  // Leaving the page with unsaved text asks first.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (latest.current.dirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Navigating away inside the app: one last save that outlives the component.
  useEffect(
    () => () => {
      const current = latest.current;
      clearTimeout(retry.current.timer);
      if (current.dirty && !current.conflict && current.draft.title.trim()) {
        const body = toSave(current.draft, current.base.version, { base: current.base.draft });
        void apiSend("PUT", `/notes/${current.saved.id}`, body, { keepalive: true })
          .then(() => queryClient.invalidateQueries({ queryKey: noteKeys.all }))
          .catch(() => undefined);
      }
    },
    [queryClient],
  );

  const keepMine = useCallback(() => {
    if (conflict) void save({ overwrite: conflict.theirs });
  }, [conflict, save]);

  const takeTheirs = useCallback(() => {
    if (!conflict) return;
    setSaved(conflict.theirs);
    setBase({ draft: draftOf(conflict.theirs), version: conflict.theirs.version });
    setDraft(draftOf(conflict.theirs));
    setConflict(null);
    setError(null);
  }, [conflict]);

  /**
   * Loads both versions of each overlapping edit into the editor between markers. Saving after
   * editing them builds on the other version, so nothing it changed is lost.
   */
  const mergeByHand = useCallback(() => {
    if (!conflict?.markers) return;
    setSaved(conflict.theirs);
    setBase({ draft: draftOf(conflict.theirs), version: conflict.theirs.version });
    setDraft((current) => ({ ...current, content: conflict.markers ?? current.content }));
    setConflict(null);
    setError(null);
  }, [conflict]);

  /** Re-reads links and backlinks after a linked note is created elsewhere. */
  const refreshLinks = useCallback(async () => {
    const fresh = await apiGet<Note>(`/notes/${saved.id}`).catch(() => null);
    if (fresh)
      setSaved((current) => ({ ...current, links: fresh.links, backlinks: fresh.backlinks }));
  }, [saved.id]);

  return {
    saved,
    draft,
    setDraft,
    status,
    error,
    conflict,
    savedAt,
    mergedAt,
    save,
    keepMine,
    takeTheirs,
    mergeByHand,
    refreshLinks,
  };
}
