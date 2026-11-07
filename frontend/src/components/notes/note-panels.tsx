"use client";

import { ArrowUpRight, History, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { fetchVersion, useCreateNote, useNoteVersions } from "@/hooks/use-notes";
import { formatRelativeSeconds } from "@/lib/time";
import type { Note, NoteLink, Version } from "@/lib/types/notes";
import { cn } from "@/lib/utils";

function linkHref(link: NoteLink): string | null {
  if (!link.resolved || !link.target_id) return null;
  if (link.kind === "note") return `/notes/${link.target_id}`;
  if (link.kind === "task") return "/tasks";
  return `/${link.kind}s/${link.target_id}`;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Link2;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="micro-label flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LinksPanel({ note, onLinksChanged }: { note: Note; onLinksChanged: () => void }) {
  const create = useCreateNote();

  return (
    <div className="flex flex-col gap-6">
      <Section title="Links" icon={Link2}>
        {note.links.length === 0 ? (
          <p className="text-xs text-faint">
            Type [[ in the note to link another note or a record.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {note.links.map((link) => {
              const href = linkHref(link);
              const label = link.target_title ?? link.label;
              return (
                <li key={link.label} className="flex items-center justify-between gap-2 text-sm">
                  {href ? (
                    <Link href={href} className="min-w-0 truncate text-primary hover:underline">
                      {label}
                      {link.kind !== "note" && (
                        <span className="ml-1.5 font-mono text-[0.625rem] text-faint">
                          {link.kind}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span
                      className="min-w-0 truncate text-muted-foreground"
                      title="Nothing matches this link yet"
                    >
                      {link.label}
                    </span>
                  )}
                  {!link.resolved && link.kind === "note" && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={create.isPending}
                      onClick={() =>
                        create.mutate({ title: link.label }, { onSuccess: onLinksChanged })
                      }
                    >
                      <Plus aria-hidden="true" />
                      Create
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {create.isError && (
          <p role="alert" className="text-xs text-destructive">
            {create.error.message}
          </p>
        )}
      </Section>

      <Section title="Backlinks" icon={ArrowUpRight}>
        {note.backlinks.length === 0 ? (
          <p className="text-xs text-faint">No other note links here yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {note.backlinks.map((backlink) => (
              <li key={backlink.id}>
                <Link
                  href={`/notes/${backlink.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {backlink.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function HistoryPanel({
  noteId,
  onRestore,
  disabled,
}: {
  noteId: string;
  onRestore: (version: Version) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const versions = useNoteVersions(noteId, open);
  const [preview, setPreview] = useState<Version | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const now = useNow();

  async function show(id: string) {
    setLoadingId(id);
    try {
      setPreview(await fetchVersion(noteId, id));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Section title="History" icon={History}>
      {!open ? (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
          Show versions
        </Button>
      ) : versions.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : versions.isError ? (
        <p className="text-xs text-destructive">
          History couldn&apos;t load: {versions.error.message}.
        </p>
      ) : (
        <ul className="flex flex-col">
          {versions.data.map((version, index) => (
            <li key={version.id}>
              <button
                type="button"
                onClick={() => void show(version.id)}
                aria-pressed={preview?.id === version.id}
                className={cn(
                  "flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  preview?.id === version.id && "bg-accent",
                )}
              >
                <span className="truncate">{index === 0 ? "Latest save" : version.title}</span>
                <span className="shrink-0 font-mono text-[0.625rem] text-faint">
                  {loadingId === version.id
                    ? "…"
                    : now
                      ? formatRelativeSeconds(new Date(version.saved_at), now)
                      : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-2">
          <pre className="max-h-56 overflow-auto font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {preview.content || "(empty)"}
          </pre>
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="xs" onClick={() => setPreview(null)}>
              Close
            </Button>
            <Button
              size="xs"
              disabled={disabled}
              onClick={() => {
                onRestore(preview);
                setPreview(null);
              }}
            >
              Restore this version
            </Button>
          </div>
          <p className="text-[0.625rem] text-faint">
            Restoring saves it as a new version; nothing is lost.
          </p>
        </div>
      )}
    </Section>
  );
}
