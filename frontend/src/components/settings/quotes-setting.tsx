"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { fieldClass, labelClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteQuote, useQuotes, useSaveQuote } from "@/hooks/use-dashboard";
import type { Quote } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

function QuoteForm({ quote, onDone }: { quote?: Quote; onDone: () => void }) {
  const save = useSaveQuote();
  const [text, setText] = useState(quote?.text ?? "");
  const [author, setAuthor] = useState(quote?.author ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    save.mutate(
      { id: quote?.id, text: text.trim(), author: author.trim() || null },
      { onSuccess: onDone },
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => event.key === "Escape" && onDone()}
      aria-label={quote ? "Edit quote" : "New quote"}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-3"
    >
      <label className={labelClass}>
        Quote
        <textarea
          autoFocus
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={cn(fieldClass, "h-auto resize-y py-2 leading-relaxed")}
        />
      </label>
      <label className={labelClass}>
        Author
        <input
          maxLength={200}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Optional"
          className={fieldClass}
        />
      </label>
      {save.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {save.error.message}.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!text.trim() || save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function QuoteItem({ quote }: { quote: Quote }) {
  const remove = useDeleteQuote();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) return <QuoteForm quote={quote} onDone={() => setEditing(false)} />;

  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 space-y-1">
        <p className="text-sm leading-relaxed">{quote.text}</p>
        {quote.author && <p className="font-mono text-[0.6875rem] text-faint">— {quote.author}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              size="xs"
              disabled={remove.isPending}
              onClick={() => remove.mutate(quote.id)}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Edit quote"
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete quote"
              className="hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function QuotesSetting() {
  const quotes = useQuotes();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Quotes</p>
          <p className="text-sm text-muted-foreground">
            One shows on Home each day. Every quote appears once before the cycle repeats.
          </p>
        </div>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add
          </Button>
        )}
      </div>
      {adding && <QuoteForm onDone={() => setAdding(false)} />}
      {quotes.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : quotes.isError ? (
        <p className="text-xs text-destructive">
          Quotes couldn&apos;t load: {quotes.error.message}.
        </p>
      ) : quotes.data.length === 0 ? (
        !adding && <p className="text-sm text-faint">No quotes yet.</p>
      ) : (
        <ul>
          {quotes.data.map((quote) => (
            <QuoteItem key={quote.id} quote={quote} />
          ))}
        </ul>
      )}
    </div>
  );
}
