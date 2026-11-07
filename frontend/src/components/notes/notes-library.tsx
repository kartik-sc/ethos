"use client";

import {
  ChevronRight,
  FilePlus2,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { WithActive } from "@/components/shell/with-active";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateFolder,
  useCreateNote,
  useDeleteFolder,
  useNoteTree,
  useUpdateFolder,
} from "@/hooks/use-notes";
import { buildLibrary, type FolderNode, untitled } from "@/lib/notes";
import type { NoteSummary } from "@/lib/types/notes";
import { cn } from "@/lib/utils";

function NoteItem({ note, depth }: { note: NoteSummary; depth: number }) {
  return (
    <li>
      <WithActive href={`/notes/${note.id}`}>
        {(active) => (
          <Link
            href={`/notes/${note.id}`}
            aria-current={active ? "page" : undefined}
            style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
            className={cn(
              "flex h-7 items-center gap-2 rounded-md pr-2 text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-sidebar-foreground hover:text-foreground",
            )}
          >
            <FileText
              aria-hidden="true"
              className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-faint")}
            />
            <span className="truncate">{note.title}</span>
          </Link>
        )}
      </WithActive>
    </li>
  );
}

function InlineName({
  initial,
  label,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  pending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1 px-1 py-0.5">
      <input
        autoFocus
        aria-label={label}
        value={name}
        maxLength={120}
        disabled={pending}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
        onBlur={() => !name.trim() && onCancel()}
        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[0.8125rem] outline-none focus-visible:border-ring"
      />
      <Button type="button" size="icon-xs" variant="ghost" aria-label="Cancel" onClick={onCancel}>
        <X />
      </Button>
    </form>
  );
}

interface FolderItemProps {
  node: FolderNode;
  depth: number;
  open: Set<string>;
  toggle: (id: string) => void;
  onNewNote: (folderId: string) => void;
  onError: (message: string | null) => void;
}

function FolderItem({ node, depth, open, toggle, onNewNote, onError }: FolderItemProps) {
  const isOpen = open.has(node.folder.id);
  const update = useUpdateFolder();
  const remove = useDeleteFolder();
  const create = useCreateFolder();
  const [mode, setMode] = useState<"rename" | "subfolder" | null>(null);
  const empty = node.children.length === 0 && node.notes.length === 0;

  return (
    <li>
      {mode === "rename" ? (
        <InlineName
          initial={node.folder.name}
          label="Folder name"
          pending={update.isPending}
          onCancel={() => setMode(null)}
          onSubmit={(name) =>
            update.mutate(
              { id: node.folder.id, name },
              { onSuccess: () => setMode(null), onError: (error) => onError(error.message) },
            )
          }
        />
      ) : (
        <div className="group flex items-center" style={{ paddingLeft: `${depth * 0.875}rem` }}>
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => toggle(node.folder.id)}
            className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left text-[0.8125rem] text-sidebar-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 text-faint transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <FolderIcon aria-hidden="true" className="size-3.5 shrink-0 text-faint" />
            <span className="truncate">{node.folder.name}</span>
          </button>
          <div className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`New note in ${node.folder.name}`}
              onClick={() => onNewNote(node.folder.id)}
            >
              <FilePlus2 />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`New folder in ${node.folder.name}`}
              onClick={() => setMode("subfolder")}
            >
              <FolderPlus />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Rename ${node.folder.name}`}
              onClick={() => setMode("rename")}
            >
              <Pencil />
            </Button>
            {empty && (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Delete empty folder ${node.folder.name}`}
                className="hover:text-destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(node.folder.id, { onError: (error) => onError(error.message) })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      )}
      {mode === "subfolder" && (
        <div style={{ paddingLeft: `${(depth + 1) * 0.875}rem` }}>
          <InlineName
            initial=""
            label="New folder name"
            pending={create.isPending}
            onCancel={() => setMode(null)}
            onSubmit={(name) =>
              create.mutate(
                { name, parent_id: node.folder.id },
                {
                  onSuccess: () => {
                    setMode(null);
                    if (!isOpen) toggle(node.folder.id);
                  },
                  onError: (error) => onError(error.message),
                },
              )
            }
          />
        </div>
      )}
      {isOpen && (
        <ul>
          {node.children.map((child) => (
            <FolderItem
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              open={open}
              toggle={toggle}
              onNewNote={onNewNote}
              onError={onError}
            />
          ))}
          {node.notes.map((note) => (
            <NoteItem key={note.id} note={note} depth={depth + 1} />
          ))}
          {node.children.length === 0 && node.notes.length === 0 && (
            <li
              className="py-1 text-[0.6875rem] text-faint"
              style={{ paddingLeft: `${1.5 + (depth + 1) * 0.875}rem` }}
            >
              Empty
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export function NotesLibrary() {
  const router = useRouter();
  const tree = useNoteTree();
  const createNote = useCreateNote();
  const createFolder = useCreateFolder();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [tag, setTag] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function newNote(folderId: string | null) {
    const title = untitled(tree.data?.notes.map((note) => note.title) ?? []);
    createNote.mutate(
      { title, folder_id: folderId },
      {
        onSuccess: (note) => {
          if (folderId) setOpen((current) => new Set(current).add(folderId));
          router.push(`/notes/${note.id}`);
        },
        onError: (error) => setProblem(error.message),
      },
    );
  }

  const library = tree.data ? buildLibrary(tree.data.folders, tree.data.notes, tag) : null;

  return (
    <nav aria-label="Notes library" className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="micro-label">Library</h2>
        <div className="flex">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="New folder"
            title="New folder"
            onClick={() => setNewFolder(true)}
          >
            <FolderPlus />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={createNote.isPending}
            onClick={() => newNote(null)}
          >
            <FilePlus2 aria-hidden="true" />
            New note
          </Button>
        </div>
      </div>

      {problem && (
        <p role="alert" className="flex items-start justify-between gap-2 text-xs text-destructive">
          {problem}
          <button type="button" aria-label="Dismiss" onClick={() => setProblem(null)}>
            <X className="size-3" />
          </button>
        </p>
      )}

      {tree.data && tree.data.tags.length > 0 && (
        <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-1">
          {tree.data.tags.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tag === name}
              onClick={() => setTag(tag === name ? null : name)}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[0.625rem] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tag === name
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border text-faint hover:text-foreground",
              )}
            >
              #{name}
            </button>
          ))}
        </div>
      )}

      {newFolder && (
        <InlineName
          initial=""
          label="New folder name"
          pending={createFolder.isPending}
          onCancel={() => setNewFolder(false)}
          onSubmit={(name) =>
            createFolder.mutate(
              { name, parent_id: null },
              {
                onSuccess: () => setNewFolder(false),
                onError: (error) => setProblem(error.message),
              },
            )
          }
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tree.isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : tree.isError ? (
          <p className="text-xs text-destructive">
            Library couldn&apos;t load: {tree.error.message}.
          </p>
        ) : library && library.folders.length === 0 && library.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tag ? `No notes tagged #${tag}.` : "No notes yet. Create one to start your library."}
          </p>
        ) : (
          library && (
            <ul>
              {library.folders.map((node) => (
                <FolderItem
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  open={open}
                  toggle={toggle}
                  onNewNote={newNote}
                  onError={setProblem}
                />
              ))}
              {library.notes.map((note) => (
                <NoteItem key={note.id} note={note} depth={0} />
              ))}
            </ul>
          )
        )}
      </div>

      <Link
        href="/notes/trash"
        className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-faint hover:text-foreground"
      >
        <Trash2 aria-hidden="true" className="size-3" />
        Trash
      </Link>
    </nav>
  );
}
