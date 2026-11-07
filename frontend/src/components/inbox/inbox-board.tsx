"use client";

import { ArrowRight, Check, CornerDownLeft, Inbox, Pencil, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { fieldClass, labelClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import {
  useCapture,
  useConvertInboxItem,
  useEditInboxItem,
  useInbox,
  useReopenInboxItem,
  useResolveInboxItem,
} from "@/hooks/use-inbox";
import { useNow } from "@/hooks/use-now";
import { type AgeTone, ageTone, firstLine, resultHref } from "@/lib/inbox";
import { formatRelativeSeconds } from "@/lib/time";
import type { ConvertKind, InboxItem, InboxView } from "@/lib/types/inbox";
import { cn } from "@/lib/utils";

const views = [
  { value: "open", label: "Open" },
  { value: "processed", label: "Processed" },
] as const;

const ageStyle: Record<AgeTone, string> = {
  fresh: "text-faint",
  aging: "text-warning",
  stale: "text-destructive",
};

const outcomeLabel: Record<NonNullable<InboxItem["outcome"]>, string> = {
  task: "became a task",
  project: "became a project",
  goal: "became a goal",
  done: "handled",
  dismissed: "dismissed",
};

function CaptureBox() {
  const capture = useCapture();
  const [content, setContent] = useState("");

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || capture.isPending) return;
    capture.mutate(trimmed, { onSuccess: () => setContent("") });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card/80 py-1.5 pr-1.5 pl-3.5 transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/25">
        <span aria-hidden="true" className="pt-1.5 font-mono text-sm text-primary select-none">
          ›
        </span>
        <label htmlFor="capture" className="sr-only">
          Capture
        </label>
        <textarea
          id="capture"
          rows={Math.min(6, Math.max(1, content.split("\n").length))}
          value={content}
          maxLength={10_000}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Anything on your mind. Enter to capture, Shift+Enter for a new line"
          className="min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={!content.trim() || capture.isPending}
          aria-label="Capture"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <CornerDownLeft aria-hidden="true" className="size-3.5" />
          Capture
        </button>
      </div>
      {capture.isError && (
        <p role="alert" className="px-1 text-xs text-destructive">
          Couldn&apos;t capture: {capture.error.message}. Your text is still here.
        </p>
      )}
    </form>
  );
}

function ConvertPanel({
  item,
  kind,
  onClose,
}: {
  item: InboxItem;
  kind: ConvertKind;
  onClose: () => void;
}) {
  const convert = useConvertInboxItem();
  const [title, setTitle] = useState(() => firstLine(item.content));
  const [date, setDate] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    convert.mutate({ id: item.id, request: { kind, title: title.trim(), due_date: date || null } });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      aria-label={`Convert to ${kind}`}
      className="flex flex-wrap items-end gap-2 border-t border-border bg-background/40 px-4 py-3"
    >
      <label className={cn(labelClass, "min-w-48 flex-1")}>
        New {kind} title
        <input
          autoFocus
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        {kind === "goal" ? "Target date" : "Deadline"}
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={cn(fieldClass, "w-40 font-mono text-xs")}
        />
      </label>
      <div className="flex gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim() || convert.isPending}>
          Create {kind}
        </Button>
      </div>
      {convert.isError && (
        <p role="alert" className="w-full text-xs text-destructive">
          Couldn&apos;t convert: {convert.error.message}. The capture is still in the Inbox.
        </p>
      )}
    </form>
  );
}

function EditPanel({ item, onClose }: { item: InboxItem; onClose: () => void }) {
  const edit = useEditInboxItem();
  const [content, setContent] = useState(item.content);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    edit.mutate({ id: item.id, content: content.trim() }, { onSuccess: onClose });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      aria-label="Edit capture"
      className="flex flex-col gap-2 border-t border-border bg-background/40 px-4 py-3"
    >
      <textarea
        autoFocus
        rows={4}
        maxLength={10_000}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className={cn(fieldClass, "h-auto resize-y py-2 leading-relaxed")}
      />
      {edit.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {edit.error.message}.
        </p>
      )}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!content.trim() || edit.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

type Panel = { type: "convert"; kind: ConvertKind } | { type: "edit" } | null;

function OpenItem({ item }: { item: InboxItem }) {
  const now = useNow();
  const resolve = useResolveInboxItem();
  const [panel, setPanel] = useState<Panel>(null);
  const tone = now ? ageTone(item.created_at, now) : "fresh";

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      className={cn(
        "overflow-hidden border-b border-border last:border-b-0",
        tone === "stale" && "bg-destructive/[0.04]",
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-start justify-between gap-4">
          <p className="min-w-0 text-sm leading-relaxed break-words whitespace-pre-line">
            {item.content}
          </p>
          {now && (
            <span className={cn("shrink-0 font-mono text-[0.6875rem]", ageStyle[tone])}>
              {tone !== "fresh" && <span aria-hidden="true">● </span>}
              {formatRelativeSeconds(new Date(item.created_at), now)}
              {tone !== "fresh" && <span className="sr-only"> — waiting a while</span>}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(["task", "project", "goal"] as const).map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="xs"
              aria-pressed={panel?.type === "convert" && panel.kind === kind}
              onClick={() =>
                setPanel(
                  panel?.type === "convert" && panel.kind === kind
                    ? null
                    : { type: "convert", kind },
                )
              }
            >
              <ArrowRight aria-hidden="true" />
              {kind[0].toUpperCase() + kind.slice(1)}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            size="xs"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: item.id, outcome: "done" })}
          >
            <Check aria-hidden="true" />
            Handled
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setPanel(panel?.type === "edit" ? null : { type: "edit" })}
          >
            <Pencil aria-hidden="true" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-destructive"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: item.id, outcome: "dismissed" })}
          >
            <X aria-hidden="true" />
            Dismiss
          </Button>
        </div>
        {resolve.isError && (
          <p role="alert" className="text-xs text-destructive">
            Couldn&apos;t update: {resolve.error.message}.
          </p>
        )}
      </div>
      {panel?.type === "convert" && (
        <ConvertPanel
          key={panel.kind}
          item={item}
          kind={panel.kind}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.type === "edit" && <EditPanel item={item} onClose={() => setPanel(null)} />}
    </motion.li>
  );
}

function ProcessedItem({ item }: { item: InboxItem }) {
  const now = useNow();
  const reopen = useReopenInboxItem();
  const href = resultHref(item);

  return (
    <li className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
          {item.content}
        </p>
        <p className="font-mono text-[0.6875rem] text-faint">
          {item.outcome &&
            (href ? (
              <Link href={href} className="text-primary hover:underline">
                {outcomeLabel[item.outcome]}
              </Link>
            ) : (
              outcomeLabel[item.outcome]
            ))}
          {item.processed_at &&
            now &&
            ` · ${formatRelativeSeconds(new Date(item.processed_at), now)}`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => reopen.mutate(item.id)}
        disabled={reopen.isPending}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <RotateCcw aria-hidden="true" className="size-3.5" />
        Reopen
      </button>
    </li>
  );
}

export function InboxBoard() {
  const [view, setView] = useState<InboxView>("open");
  const items = useInbox(view);

  return (
    <div className="flex flex-col gap-6">
      <CaptureBox />

      <div className="flex items-center justify-between gap-3">
        <ViewTabs label="Inbox views" views={views} value={view} onChange={setView} />
        {items.data && (
          <span className="font-mono text-[0.6875rem] text-faint" aria-live="polite">
            {items.data.length} {view}
          </span>
        )}
      </div>

      {items.isPending ? (
        <div
          className="space-y-3 rounded-xl border border-border bg-card/80 p-4"
          aria-hidden="true"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : items.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            Inbox couldn&apos;t load: {items.error.message}.
          </span>
          <button
            type="button"
            onClick={() => void items.refetch()}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      ) : items.data.length === 0 ? (
        <EmptyState icon={Inbox} title={view === "open" ? "Inbox zero" : "Nothing processed yet"}>
          {view === "open"
            ? "Captures land here until you turn them into something or set them aside."
            : "Converted, handled and dismissed captures are kept here and can be reopened."}
        </EmptyState>
      ) : (
        <ul className="rounded-xl border border-border bg-card/80">
          <AnimatePresence initial={false}>
            {items.data.map((item) =>
              view === "open" ? (
                <OpenItem key={item.id} item={item} />
              ) : (
                <ProcessedItem key={item.id} item={item} />
              ),
            )}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
