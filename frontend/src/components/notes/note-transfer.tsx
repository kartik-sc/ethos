"use client";

import { Download, FileUp, FolderUp, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchFolderExport, type ImportResult, useImportNotes } from "@/hooks/use-notes";
import {
  directoryPicker,
  downloadEach,
  planImport,
  readPicked,
  writeToDirectory,
} from "@/lib/notes-transfer";

interface Summary {
  result: ImportResult | null;
  skipped: { path: string; reason: string }[];
}

/** Two hidden pickers: individual Markdown files, or a whole folder with its structure. */
export function ImportNotes() {
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const importNotes = useImportNotes();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reading, setReading] = useState(false);

  async function onPicked(list: FileList | null) {
    if (!list || list.length === 0) return;
    setReading(true);
    try {
      const plan = planImport(await readPicked(list));
      if (plan.files.length === 0) {
        setSummary({ result: null, skipped: plan.skipped });
        return;
      }
      importNotes.mutate(
        { folder_id: null, files: plan.files },
        {
          onSuccess: (result) =>
            setSummary({ result, skipped: [...plan.skipped, ...result.skipped] }),
        },
      );
    } finally {
      setReading(false);
      if (files.current) files.current.value = "";
      if (folder.current) folder.current.value = "";
    }
  }

  const busy = reading || importNotes.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="micro-label mr-auto">Import</span>
        {busy && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-faint" />}
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => files.current?.click()}>
          <FileUp aria-hidden="true" />
          Files
        </Button>
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => folder.current?.click()}>
          <FolderUp aria-hidden="true" />
          Folder
        </Button>
      </div>
      <input
        ref={files}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple
        hidden
        aria-label="Import Markdown files"
        onChange={(event) => void onPicked(event.target.files)}
      />
      <input
        ref={(element) => {
          folder.current = element;
          // Not in React's typings; lets the picker choose a folder and keep relative paths.
          element?.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        hidden
        aria-label="Import a folder of Markdown files"
        onChange={(event) => void onPicked(event.target.files)}
      />

      {importNotes.isError && (
        <p role="alert" className="text-xs text-destructive">
          Import failed: {importNotes.error.message}. Nothing was imported.
        </p>
      )}
      {summary && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-lg border border-border bg-card/80 p-2 text-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <p>
              {summary.result
                ? `Imported ${summary.result.created.length} note${summary.result.created.length === 1 ? "" : "s"}` +
                  (summary.result.folders_created
                    ? `, ${summary.result.folders_created} new folders`
                    : "")
                : "Nothing to import"}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setSummary(null)}
              className="text-faint hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
          {summary.result?.renamed.map((item) => (
            <p key={item.path} className="text-muted-foreground">
              {item.path} → “{item.title}” (title was taken)
            </p>
          ))}
          {summary.skipped.map((item) => (
            <p key={item.path} className="text-faint">
              Skipped {item.path}: {item.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Exports one folder: real folders via the directory picker, or one download per note. */
export function ExportFolderButton({ folderId, name }: { folderId: string; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");

  async function run() {
    setState("busy");
    try {
      const files = await fetchFolderExport(folderId);
      const picker = directoryPicker();
      if (picker) await writeToDirectory(await picker({ mode: "readwrite" }), files);
      else downloadEach(files);
      setState("done");
    } catch (error) {
      // Closing the picker is a choice, not a failure.
      setState(error instanceof DOMException && error.name === "AbortError" ? "idle" : "failed");
    }
  }

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label={`Export ${name} as Markdown`}
      title={
        state === "failed"
          ? "Export failed, try again"
          : state === "done"
            ? "Exported"
            : "Export as Markdown"
      }
      disabled={state === "busy"}
      className={state === "failed" ? "text-destructive" : undefined}
      onClick={() => void run()}
    >
      {state === "busy" ? <LoaderCircle className="animate-spin" /> : <Download />}
    </Button>
  );
}
