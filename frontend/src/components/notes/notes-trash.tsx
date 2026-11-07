"use client";

import { RotateCcw, Trash2 } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { useRestoreNote, useTrashedNotes } from "@/hooks/use-notes";
import { trashLabel } from "@/lib/trash";
import type { NoteSummary } from "@/lib/types/notes";

function TrashedNote({ note }: { note: NoteSummary }) {
  const restore = useRestoreNote();
  const now = useNow();

  return (
    <li className="flex flex-col gap-1 border-b border-border px-4 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{note.title}</p>
          {note.deleted_at && now && (
            <p className="font-mono text-[0.6875rem] text-faint">
              {trashLabel(note.deleted_at, now)} · history comes back with it
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => restore.mutate(note.id)}
          disabled={restore.isPending}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Restore
        </button>
      </div>
      {restore.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t restore: {restore.error.message}. Rename the other note first.
        </p>
      )}
    </li>
  );
}

export function NotesTrash() {
  const notes = useTrashedNotes();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/notes" label="notes" />
      <h1 className="text-2xl font-medium tracking-[-0.015em]">Notes Trash</h1>
      {notes.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : notes.isError ? (
        <p className="text-sm text-destructive">Trash couldn&apos;t load: {notes.error.message}.</p>
      ) : notes.data.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty">
          Deleted notes stay here for 30 days with their history, then they are removed for good.
        </EmptyState>
      ) : (
        <ul className="rounded-xl border border-border bg-card/80">
          {notes.data.map((note) => (
            <TrashedNote key={note.id} note={note} />
          ))}
        </ul>
      )}
    </div>
  );
}
