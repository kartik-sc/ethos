"use client";

import { CalendarDays, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { cn } from "@/lib/utils";

interface QuickCreateProps {
  id: string;
  label: string;
  placeholder: string;
  dateLabel: string;
  pending: boolean;
  error: Error | null;
  /** Call `reset` once the record is saved; on failure the text stays put. */
  onCreate: (title: string, date: string | null, reset: () => void) => void;
}

export function QuickCreate({
  id,
  label,
  placeholder,
  dateLabel,
  pending,
  error,
  onCreate,
}: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    onCreate(trimmed, date || null, () => {
      setTitle("");
      setDate("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 py-1.5 pr-1.5 pl-3.5 transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/25">
        <span aria-hidden="true" className="font-mono text-sm text-primary select-none">
          ›
        </span>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder={placeholder}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <label
          className={cn(
            "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 font-mono text-[0.6875rem] transition-colors",
            "focus-within:ring-2 focus-within:ring-ring hover:bg-accent",
            date ? "text-foreground" : "text-faint",
          )}
        >
          <CalendarDays aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{dateLabel}</span>
          <input
            type="date"
            value={date}
            onClick={(event) => event.currentTarget.showPicker?.()}
            onChange={(event) => setDate(event.target.value)}
            className={cn(
              "bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:hidden",
              date ? "w-[6.75rem]" : "w-0 sm:w-[6.75rem]",
            )}
          />
        </label>
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          {pending && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />}
          Create
        </button>
      </div>
      {error && (
        <p role="alert" className="px-1 text-xs text-destructive">
          Couldn&apos;t create it: {error.message}. Your text is still here.
        </p>
      )}
    </form>
  );
}
