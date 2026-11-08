"use client";

import { FileUp, Paperclip, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { type DragEvent, type FormEvent, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import {
  useProjectFiles,
  useRenameFile,
  useRestoreFile,
  useTrashFile,
  useUploadFile,
} from "@/hooks/use-files";
import { useNow } from "@/hooks/use-now";
import { ApiError } from "@/lib/api";
import { fileBadge, fileUrl, formatBytes, isFileConflict, MAX_FILE_BYTES } from "@/lib/files";
import { formatRelativeSeconds } from "@/lib/time";
import { trashLabel } from "@/lib/trash";
import type { FileAsset, FileView } from "@/lib/types/files";
import { cn } from "@/lib/utils";

const views: { value: FileView; label: string }[] = [
  { value: "active", label: "Files" },
  { value: "trash", label: "Trash" },
];

interface Conflict {
  file: File;
  existing: FileAsset;
}

interface Problem {
  name: string;
  message: string;
}

function FileRow({ asset, now }: { asset: FileAsset; now: Date | null }) {
  const rename = useRenameFile();
  const trash = useTrashFile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.filename);

  function save(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === asset.filename) return setEditing(false);
    rename.mutate({ id: asset.id, filename: next }, { onSuccess: () => setEditing(false) });
  }

  return (
    <li className="group flex items-center gap-3 px-4 py-2.5">
      <span
        aria-hidden="true"
        className="inline-flex h-6 min-w-9 items-center justify-center rounded border border-border bg-background px-1 font-mono text-[0.625rem] text-faint"
      >
        {fileBadge(asset.filename) || <Paperclip className="size-3" />}
      </span>
      {editing ? (
        <form onSubmit={save} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            autoFocus
            aria-label="File name"
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
            className={cn(fieldClass, "h-7 flex-1 text-sm")}
          />
          <Button type="submit" size="xs" disabled={rename.isPending}>
            Save
          </Button>
          {rename.isError && (
            <span role="alert" className="text-xs text-destructive">
              {rename.error.message}
            </span>
          )}
        </form>
      ) : (
        <>
          <a
            href={fileUrl(asset.id)}
            download={asset.filename}
            className="min-w-0 flex-1 truncate text-sm outline-none hover:text-primary focus-visible:underline"
          >
            {asset.filename}
          </a>
          <span className="hidden font-mono text-[0.6875rem] text-faint sm:inline">
            {formatBytes(asset.size_bytes)}
            {now && ` · ${formatRelativeSeconds(new Date(asset.updated_at), now)}`}
          </span>
          <div className="flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Rename ${asset.filename}`}
              onClick={() => {
                setName(asset.filename);
                setEditing(true);
              }}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${asset.filename} to Trash`}
              className="hover:text-destructive"
              disabled={trash.isPending}
              onClick={() => trash.mutate(asset.id)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </li>
  );
}

function TrashedRow({ asset, now }: { asset: FileAsset; now: Date | null }) {
  const restore = useRestoreFile();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {asset.filename}
      </span>
      {now && asset.deleted_at && (
        <span className="font-mono text-[0.6875rem] text-faint">
          {trashLabel(asset.deleted_at, now)}
        </span>
      )}
      <Button
        variant="ghost"
        size="xs"
        disabled={restore.isPending}
        onClick={() => restore.mutate(asset.id)}
      >
        <RotateCcw aria-hidden="true" />
        Restore
      </Button>
      {restore.isError && (
        <span role="alert" className="w-full text-xs text-destructive">
          {restore.error.message}
        </span>
      )}
    </li>
  );
}

export function ProjectFiles({ projectId }: { projectId: string }) {
  const [view, setView] = useState<FileView>("active");
  const files = useProjectFiles(projectId, view);
  const upload = useUploadFile();
  const now = useNow();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadAll(picked: File[]) {
    setProblems([]);
    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) {
        setProblems((list) => [...list, { name: file.name, message: "larger than 25 MB" }]);
        continue;
      }
      setUploading(file.name);
      try {
        await upload.mutateAsync({ projectId, file });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && isFileConflict(error.body)) {
          const { existing } = error.body;
          setConflicts((list) => [...list, { file, existing }]);
        } else {
          const message = error instanceof Error ? error.message : "upload failed";
          setProblems((list) => [...list, { name: file.name, message }]);
        }
      }
    }
    setUploading(null);
  }

  async function replace(conflict: Conflict) {
    setConflicts((list) => list.filter((item) => item !== conflict));
    setUploading(conflict.file.name);
    try {
      await upload.mutateAsync({ projectId, file: conflict.file, replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "upload failed";
      setProblems((list) => [...list, { name: conflict.file.name, message }]);
    }
    setUploading(null);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) {
      setView("active");
      void uploadAll(dropped);
    }
  }

  const list = files.data ?? [];

  return (
    <section
      aria-label="Project files"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        "flex flex-col gap-3 rounded-xl transition-shadow",
        dragging && "ring-2 ring-primary/50 ring-offset-4 ring-offset-background",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <ViewTabs label="File views" views={views} value={view} onChange={setView} />
        <div className="flex items-center gap-3">
          {uploading && (
            <span
              className="max-w-48 truncate font-mono text-[0.6875rem] text-faint"
              aria-live="polite"
            >
              uploading {uploading}…
            </span>
          )}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (picked.length > 0) void uploadAll(picked);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading !== null}
            onClick={() => input.current?.click()}
          >
            <FileUp aria-hidden="true" />
            Upload
          </Button>
        </div>
      </div>

      {conflicts.map((conflict) => (
        <div
          key={`${conflict.file.name}-${conflict.file.lastModified}`}
          role="alertdialog"
          aria-label={`Replace ${conflict.existing.filename}?`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 py-1.5 pr-1.5 pl-3 text-xs"
        >
          <span className="min-w-0 flex-1 text-muted-foreground">
            <span className="text-foreground">{conflict.existing.filename}</span> already exists (
            {formatBytes(conflict.existing.size_bytes)}). Replacing keeps only the new version.
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setConflicts((items) => items.filter((item) => item !== conflict))}
          >
            Keep existing
          </Button>
          <Button size="xs" disabled={uploading !== null} onClick={() => void replace(conflict)}>
            Replace
          </Button>
        </div>
      ))}

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 text-xs text-destructive">
          {problems.map((problem) => (
            <li key={problem.name}>
              {problem.name} wasn&apos;t uploaded: {problem.message}.
            </li>
          ))}
        </ul>
      )}

      {files.isPending ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-card/80">
          {[56, 38].map((width) => (
            <div key={width} className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
              <Skeleton className="h-6 w-9" />
              <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      ) : files.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            Files couldn&apos;t load: {files.error.message}.
          </span>
          <Button variant="ghost" size="xs" onClick={() => void files.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={view === "active" ? Paperclip : Trash2}
          title={view === "active" ? "No files yet" : "No deleted files"}
        >
          {view === "active"
            ? "Upload or drop files here, up to 25 MB each. Notes stay text-only."
            : "Deleted files stay here for 30 days."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card/80">
          {list.map((asset) =>
            view === "active" ? (
              <FileRow key={asset.id} asset={asset} now={now} />
            ) : (
              <TrashedRow key={asset.id} asset={asset} now={now} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
