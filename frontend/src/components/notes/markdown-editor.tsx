"use client";

import { FileText, FolderKanban, ListTodo, Target } from "lucide-react";
import { type KeyboardEvent, useDeferredValue, useRef, useState } from "react";

import { useLinkTargets } from "@/hooks/use-notes";
import { insertWikiLink, type WikiQuery, wikiQueryAt } from "@/lib/notes";
import type { LinkKind, LinkTarget } from "@/lib/types/notes";
import { cn } from "@/lib/utils";

const kindIcon: Record<LinkKind, typeof FileText> = {
  note: FileText,
  task: ListTodo,
  project: FolderKanban,
  goal: Target,
};

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function MarkdownEditor({ value, onChange, onSave }: MarkdownEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [wiki, setWiki] = useState<WikiQuery | null>(null);
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(wiki?.query ?? null);
  const targets = useLinkTargets(deferredQuery);
  const suggestions: LinkTarget[] = wiki ? (targets.data ?? []) : [];

  function track() {
    const element = textarea.current;
    if (!element) return;
    const next = wikiQueryAt(element.value, element.selectionStart);
    if (next?.start !== wiki?.start || next?.query !== wiki?.query) setActive(0);
    setWiki(next);
  }

  function pick(target: LinkTarget) {
    const element = textarea.current;
    if (!element || !wiki) return;
    const result = insertWikiLink(value, wiki, element.selectionStart, target.title, target.kind);
    onChange(result.text);
    setWiki(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(result.caret, result.caret);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave();
      return;
    }
    if (!wiki || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(suggestions[active] ?? suggestions[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setWiki(null);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <label htmlFor="note-body" className="sr-only">
        Note text (Markdown)
      </label>
      <textarea
        id="note-body"
        ref={textarea}
        value={value}
        spellCheck
        onChange={(event) => {
          onChange(event.target.value);
          requestAnimationFrame(track);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) track();
        }}
        onClick={track}
        onBlur={() => setTimeout(() => setWiki(null), 150)}
        aria-autocomplete="list"
        aria-controls={wiki ? "wiki-suggestions" : undefined}
        placeholder={
          "# Heading\n\nWrite in Markdown. Type [[ to link a note, or [[task: / [[project: / [[goal: to link a record."
        }
        className={cn(
          "min-h-[55vh] w-full flex-1 resize-none bg-transparent font-mono text-[0.8125rem] leading-[1.7] text-foreground outline-none",
          "placeholder:text-faint",
        )}
      />

      {wiki && (
        <div
          id="wiki-suggestions"
          role="listbox"
          aria-label="Link suggestions"
          className="absolute inset-x-0 bottom-3 z-10 mx-auto max-w-md overflow-hidden rounded-lg border border-border-strong bg-popover shadow-xl"
        >
          <p className="border-b border-border px-3 py-1.5 font-mono text-[0.625rem] text-faint">
            [[{wiki.query || "…"} · ↑↓ to choose · enter to link · esc to close
          </p>
          {suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {targets.isFetching
                ? "Looking…"
                : "No match. Finish the title and close with ]] to link it later."}
            </p>
          ) : (
            <ul>
              {suggestions.map((target, index) => {
                const Icon = kindIcon[target.kind];
                return (
                  <li key={`${target.kind}-${target.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(target)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                        index === active ? "bg-accent text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{target.title}</span>
                      {target.kind !== "note" && (
                        <span className="ml-auto font-mono text-[0.625rem] text-faint">
                          {target.kind}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
