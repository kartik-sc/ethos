"use client";

import {
  ArrowRight,
  Check,
  CornerDownLeft,
  Inbox,
  Search,
  SquareSlash,
  TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useDeferredValue, useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCommandPreview, useRunCommand } from "@/hooks/use-command";
import { ApiError } from "@/lib/api";
import { formatShortDate } from "@/lib/time";
import {
  opensAfterRun,
  type PaletteItem,
  recordHref,
  resultHref,
  suggestions,
  wantsPreview,
} from "@/lib/commands";
import type { CommandResult, Duplicate } from "@/lib/types/commands";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/stores/command-palette";

function duplicatesFrom(error: unknown): Duplicate[] | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { duplicates?: Duplicate[] } | null;
  return body?.duplicates ?? null;
}

function ItemRow({
  item,
  active,
  onPick,
}: {
  item: PaletteItem;
  active: boolean;
  onPick: () => void;
}) {
  const base = cn(
    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
    active ? "bg-accent text-foreground" : "text-muted-foreground",
  );
  const content = (() => {
    switch (item.type) {
      case "command":
        return (
          <>
            <SquareSlash aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="font-mono text-foreground">/{item.command.name}</span>
            <span className="truncate">{item.command.description}</span>
          </>
        );
      case "navigate": {
        const Icon = item.item.icon;
        return (
          <>
            <Icon aria-hidden="true" className="size-4 shrink-0 text-faint" />
            <span>Go to {item.item.label}</span>
          </>
        );
      }
      case "capture":
        return (
          <>
            <Inbox aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              Add to Inbox: <span className="text-foreground">{item.text}</span>
            </span>
          </>
        );
      case "search":
        return (
          <>
            <Search aria-hidden="true" className="size-4 shrink-0 text-faint" />
            <span className="truncate">
              Search for <span className="text-foreground">{item.text}</span>
            </span>
          </>
        );
    }
  })();
  return (
    <li>
      <button type="button" role="option" aria-selected={active} onClick={onPick} className={base}>
        {content}
        {active && (
          <CornerDownLeft aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-faint" />
        )}
      </button>
    </li>
  );
}

function PreviewPanel({
  text,
  duplicates,
  confirming,
}: {
  text: string;
  duplicates: Duplicate[] | null;
  confirming: boolean;
}) {
  const preview = useCommandPreview(text);
  if (preview.isPending) {
    return (
      <div className="space-y-2 px-4 py-3" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }
  if (preview.isError) {
    return (
      <p className="px-4 py-3 text-sm text-destructive">
        Couldn&apos;t read that: {preview.error.message}
      </p>
    );
  }
  const data = preview.data;
  const shownDuplicates = duplicates ?? data.duplicates;
  return (
    <div className="flex flex-col gap-3 px-4 py-3" aria-live="polite">
      <p className="micro-label">{data.action}</p>
      {data.fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {data.fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="font-mono text-[0.6875rem] leading-5 text-faint">{field.label}</dt>
              <dd className="min-w-0 truncate">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.question && <p className="text-sm text-warning">{data.question}</p>}
      {data.error && <p className="text-sm text-destructive">{data.error}</p>}
      {data.notes.map((note) => (
        <p key={note} className="text-xs text-muted-foreground">
          {note}
        </p>
      ))}
      {shownDuplicates.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/5 p-2">
          <p className="flex items-center gap-1.5 text-xs text-foreground">
            <TriangleAlert aria-hidden="true" className="size-3.5 text-warning" />
            Possibly already exists:
          </p>
          <ul className="flex flex-col">
            {shownDuplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link
                  href={recordHref(duplicate.kind, duplicate.id)}
                  className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs text-primary hover:underline"
                >
                  <span className="truncate">{duplicate.title}</span>
                  <span className="shrink-0 font-mono text-faint">
                    {duplicate.due ? formatShortDate(duplicate.due) : duplicate.kind}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[0.6875rem] text-muted-foreground">
            {confirming
              ? "Press Enter again to create it anyway."
              : "Enter will ask before creating another."}
          </p>
        </div>
      )}
      {data.ready && !confirming && (
        <p className="font-mono text-[0.6875rem] text-faint">
          enter to {data.action.toLowerCase()}
        </p>
      )}
    </div>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen, toggle } = useCommandPalette();
  const run = useRunCommand();
  const input = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const deferred = useDeferredValue(text);
  const previewing = wantsPreview(text);
  const items = previewing ? [] : suggestions(text);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => input.current?.focus());
    } else {
      returnFocus.current?.focus?.();
    }
  }, [open]);

  function close() {
    setOpen(false);
    setText("");
    setDuplicates(null);
    setFailure(null);
    setResult(null);
  }

  function edit(value: string) {
    setText(value);
    setActive(0);
    setDuplicates(null);
    setFailure(null);
    setResult(null);
  }

  function execute(command: string) {
    run.mutate(
      { text: command, confirm_duplicate: duplicates !== null },
      {
        onSuccess: (done) => {
          setText("");
          setDuplicates(null);
          setResult(done);
          const href = resultHref(done);
          if (opensAfterRun(done) && href) {
            router.push(href);
            close();
          }
        },
        onError: (error) => {
          const found = duplicatesFrom(error);
          if (found) setDuplicates(found);
          else setFailure(error.message);
        },
      },
    );
  }

  function pick(item: PaletteItem) {
    switch (item.type) {
      case "command":
        edit(`/${item.command.name} `);
        input.current?.focus();
        return;
      case "navigate":
        router.push(item.item.href);
        close();
        return;
      case "capture":
        execute(item.text);
        return;
      case "search":
        router.push(`/search?q=${encodeURIComponent(item.text)}`);
        close();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" && items.length) {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp" && items.length) {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Tab" && items[active]?.type === "command") {
      event.preventDefault();
      pick(items[active]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (run.isPending) return;
      if (previewing) execute(text);
      else if (items[active]) pick(items[active]);
    }
  }

  const doneHref = result ? resultHref(result) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border-strong bg-popover shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <span aria-hidden="true" className="font-mono text-sm text-primary select-none">
                ›
              </span>
              <input
                ref={input}
                value={text}
                onChange={(event) => edit(event.target.value)}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls="palette-items"
                aria-label="Command"
                autoComplete="off"
                spellCheck={false}
                placeholder="Type / for commands, or anything to capture"
                className="h-12 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-faint"
              />
              <kbd className="font-mono text-[0.625rem] text-faint">esc</kbd>
            </div>

            <div className="min-h-0 overflow-y-auto">
              {previewing ? (
                <PreviewPanel
                  text={deferred.trim()}
                  duplicates={duplicates}
                  confirming={duplicates !== null}
                />
              ) : (
                <ul id="palette-items" role="listbox" aria-label="Suggestions" className="p-1.5">
                  {items.map((item, index) => (
                    <ItemRow
                      key={`${item.type}-${index}`}
                      item={item}
                      active={index === active}
                      onPick={() => pick(item)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {(result || failure || run.isPending) && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm"
              >
                {run.isPending ? (
                  <span className="text-muted-foreground">Working…</span>
                ) : failure ? (
                  <span className="text-destructive">{failure}</span>
                ) : result ? (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                      <span className="truncate">{result.message}</span>
                    </span>
                    {doneHref && (
                      <Link
                        href={doneHref}
                        onClick={close}
                        className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open <ArrowRight aria-hidden="true" className="size-3" />
                      </Link>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
