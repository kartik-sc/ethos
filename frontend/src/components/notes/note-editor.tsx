"use client";

import { Download, FileX, LoaderCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Conflict, useNoteDraft } from "@/hooks/use-note-draft";
import { useNow } from "@/hooks/use-now";
import { useNote, useNoteTree, useTrashNote } from "@/hooks/use-notes";
import { ApiError } from "@/lib/api";
import { MARKER, type SaveStatus } from "@/lib/note-draft";
import { folderPath, markdownFilename, parseTags } from "@/lib/notes";
import { formatRelativeSeconds } from "@/lib/time";
import type { Note } from "@/lib/types/notes";
import { cn } from "@/lib/utils";

import { MarkdownEditor } from "./markdown-editor";
import { HistoryPanel, LinksPanel } from "./note-panels";

const statusStyle: Record<SaveStatus, string> = {
  saved: "text-faint",
  dirty: "text-warning",
  saving: "text-muted-foreground",
  error: "text-destructive",
  conflict: "text-destructive",
};

function StatusLabel({
  status,
  savedAt,
  error,
}: {
  status: SaveStatus;
  savedAt: Date;
  error: string | null;
}) {
  const now = useNow();
  const text = {
    saved: now ? `Saved ${formatRelativeSeconds(savedAt, now)}` : "Saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: `Not saved: ${error ?? "error"}`,
    conflict: "Changed elsewhere",
  }[status];
  return (
    <span
      role="status"
      className={cn("flex items-center gap-1.5 font-mono text-[0.6875rem]", statusStyle[status])}
    >
      {status === "saving" && <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />}
      {status === "dirty" && <span aria-hidden="true">●</span>}
      {text}
    </span>
  );
}

function download(title: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = markdownFilename(title);
  anchor.click();
  URL.revokeObjectURL(url);
}

function ConflictPanel({
  conflict,
  onKeepMine,
  onTakeTheirs,
  onMergeByHand,
}: {
  conflict: Conflict;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onMergeByHand: () => void;
}) {
  const theirs = conflict.theirs;
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">
          This note was saved somewhere else, and both of you changed the same part.
        </p>
        <p className="text-xs text-muted-foreground">
          Edits to different parts merge on their own; these overlap, so nothing was saved. Your
          text is still here. Keeping yours stores the other version in History, so neither is lost.
        </p>
      </div>
      <details className="rounded-lg border border-border bg-background/60">
        <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
          The other version: “{theirs.title}”
        </summary>
        <pre className="max-h-64 overflow-auto px-3 pb-3 font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap">
          {theirs.content || "(empty)"}
        </pre>
      </details>
      <div className="flex flex-wrap gap-2">
        {conflict.markers !== null && (
          <Button size="sm" onClick={onMergeByHand}>
            Merge by hand
          </Button>
        )}
        <Button
          size="sm"
          variant={conflict.markers !== null ? "outline" : "default"}
          onClick={onKeepMine}
        >
          Keep mine
        </Button>
        {confirmDiscard ? (
          <>
            <Button size="sm" variant="destructive" onClick={onTakeTheirs}>
              Discard my changes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirmDiscard(true)}>
            Use the other version
          </Button>
        )}
      </div>
    </div>
  );
}

function EditorBody({ initial }: { initial: Note }) {
  const router = useRouter();
  const tree = useNoteTree();
  const trash = useTrashNote();
  const editor = useNoteDraft(initial);
  const { draft, setDraft, status } = editor;
  const [tagText, setTagText] = useState(() => draft.tags.join(", "));
  const [confirmTrash, setConfirmTrash] = useState(false);
  const folders = tree.data?.folders ?? [];
  const savedAt = editor.savedAt ?? new Date(editor.saved.updated_at);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="md:hidden">
          <BackLink href="/notes" label="notes" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusLabel status={status} savedAt={savedAt} error={editor.error} />
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={status === "dirty" || status === "error" ? "default" : "ghost"}
              disabled={status === "saving" || status === "conflict" || status === "saved"}
              onClick={() => void editor.save()}
              title="Save (Ctrl+S)"
            >
              <Save aria-hidden="true" />
              Save
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Download as Markdown"
              title="Download as Markdown"
              onClick={() => download(draft.title, draft.content)}
            >
              <Download />
            </Button>
            {confirmTrash ? (
              <>
                <Button
                  size="xs"
                  variant="destructive"
                  disabled={trash.isPending}
                  onClick={() =>
                    trash.mutate(editor.saved.id, { onSuccess: () => router.push("/notes") })
                  }
                >
                  Move to Trash
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setConfirmTrash(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Move note to Trash"
                className="hover:text-destructive"
                onClick={() => setConfirmTrash(true)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>

        {editor.conflict && (
          <ConflictPanel
            conflict={editor.conflict}
            onKeepMine={editor.keepMine}
            onTakeTheirs={editor.takeTheirs}
            onMergeByHand={editor.mergeByHand}
          />
        )}
        {!editor.conflict && draft.content.includes(MARKER) && (
          <p
            role="note"
            className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-muted-foreground"
          >
            Each overlap is shown as <code className="font-mono">{MARKER}</code> (your text),{" "}
            <code className="font-mono">=======</code>, then the other version, ending at{" "}
            <code className="font-mono">&gt;&gt;&gt;&gt;&gt;&gt;&gt; other version</code>. Keep what
            you want, delete the markers, then save.
          </p>
        )}
        {editor.mergedAt && !editor.conflict && status !== "dirty" && (
          <p role="status" className="font-mono text-[0.6875rem] text-primary">
            Merged with changes made elsewhere · the previous version is in History
          </p>
        )}

        <label htmlFor="note-title" className="sr-only">
          Title
        </label>
        <input
          id="note-title"
          value={draft.title}
          maxLength={200}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              void editor.save();
            }
          }}
          placeholder="Title"
          className="bg-transparent text-2xl font-medium tracking-[-0.015em] outline-none placeholder:text-faint"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Folder"
            value={draft.folderId ?? ""}
            onChange={(event) => setDraft({ ...draft, folderId: event.target.value || null })}
            className={cn(fieldClass, "h-7 w-auto max-w-56 text-xs")}
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folderPath(folders, folder.id)}
              </option>
            ))}
          </select>
          <label className="flex min-w-48 flex-1 items-center gap-1.5 font-mono text-xs text-faint">
            #<span className="sr-only">Tags, separated by commas or spaces</span>
            <input
              value={tagText}
              onChange={(event) => {
                setTagText(event.target.value);
                setDraft({ ...draft, tags: parseTags(event.target.value) });
              }}
              placeholder="tags, comma or space separated"
              className="h-7 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-faint"
            />
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card/60 px-4 py-3 focus-within:border-ring/50">
          <MarkdownEditor
            value={draft.content}
            onChange={(content) => setDraft({ ...draft, content })}
            onSave={() => void editor.save()}
          />
        </div>
        <p className="font-mono text-[0.625rem] text-faint">
          Markdown · autosaves every 2 minutes while there are changes · Ctrl+S to save now
        </p>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-6 border-t border-border pt-6 lg:w-64 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <LinksPanel note={editor.saved} onLinksChanged={() => void editor.refreshLinks()} />
        <HistoryPanel
          noteId={editor.saved.id}
          disabled={status === "saving" || status === "conflict"}
          onRestore={(version) => {
            const restored = { ...draft, title: version.title, content: version.content };
            setDraft(restored);
            void editor.save({ draft: restored });
          }}
        />
      </aside>
    </div>
  );
}

export function NoteEditor({ id }: { id: string }) {
  const note = useNote(id);

  if (note.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[50vh] w-full rounded-xl" />
      </div>
    );
  }
  if (note.isError) {
    const missing = note.error instanceof ApiError && note.error.status === 404;
    return (
      <EmptyState icon={FileX} title={missing ? "Note not found" : "Note couldn't load"}>
        {missing ? "It may be in Trash. Restore it from Notes → Trash." : note.error.message}
      </EmptyState>
    );
  }
  return <EditorBody key={note.data.id} initial={note.data} />;
}
