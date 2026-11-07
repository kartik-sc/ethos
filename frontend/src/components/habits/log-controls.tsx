"use client";

import { Check, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { useLogHabit } from "@/hooks/use-habits";
import { formatAmount } from "@/lib/habits";
import type { Habit } from "@/lib/types/habits";
import { cn } from "@/lib/utils";

interface LogButtonProps {
  habit: Habit;
  /** Amount and span habits need a value, so they open the form instead of toggling. */
  onOpenForm: () => void;
}

export function LogButton({ habit, onOpenForm }: LogButtonProps) {
  const log = useLogHabit();
  const { today, today_log: entry } = habit.summary;
  const met = today.state === "met";

  if (habit.measure === "check") {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={met}
        aria-label={met ? `Undo ${habit.title} for today` : `Mark ${habit.title} done today`}
        disabled={log.isPending}
        onClick={() => log.mutate({ habitId: habit.id, date: today.date, entry: met ? null : {} })}
        className={cn(
          "group/check inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          met
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border-strong hover:border-primary/60 hover:bg-primary/10",
        )}
      >
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className={cn("size-3", met ? "opacity-100" : "opacity-0 group-hover/check:opacity-60")}
        />
      </button>
    );
  }

  const target = habit.target_amount ? formatAmount(habit.target_amount) : null;
  return (
    <button
      type="button"
      onClick={onOpenForm}
      aria-label={`Log ${habit.title} for today`}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 font-mono text-[0.6875rem] tabular-nums transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        met
          ? "border-primary bg-primary text-primary-foreground"
          : entry
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border-strong text-muted-foreground hover:border-primary/60 hover:text-foreground",
      )}
    >
      {entry?.amount ? (
        <>
          {formatAmount(entry.amount)}
          {target && <span className="opacity-60">/{target}</span>}
          <span className="opacity-70">{habit.unit}</span>
        </>
      ) : (
        <>
          <Plus aria-hidden="true" className="size-3" />
          log
        </>
      )}
    </button>
  );
}

interface LogFormProps {
  habit: Habit;
  onClose: () => void;
}

export function LogForm({ habit, onClose }: LogFormProps) {
  const log = useLogHabit();
  const { today, today_log: entry } = habit.summary;
  const [amount, setAmount] = useState(entry?.amount ? formatAmount(entry.amount) : "");
  const [start, setStart] = useState(entry?.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(entry?.end_time?.slice(0, 5) ?? "");
  const [note, setNote] = useState(entry?.note ?? "");

  const ready =
    habit.measure === "span"
      ? Boolean(start && end)
      : habit.measure === "check" || Number(amount) > 0;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    log.mutate(
      {
        habitId: habit.id,
        date: today.date,
        entry: {
          amount: habit.measure === "amount" ? Number(amount) : null,
          start_time: habit.measure === "span" ? start : null,
          end_time: habit.measure === "span" ? end : null,
          note: note.trim() || null,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form
      onSubmit={save}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      aria-label={`Log ${habit.title}`}
      className="flex flex-wrap items-end gap-2 border-t border-border bg-background/40 px-4 py-3 sm:pl-31"
    >
      {habit.measure === "amount" && (
        <label className="flex flex-col gap-1 text-[0.6875rem] text-muted-foreground">
          {habit.unit ? `Amount (${habit.unit})` : "Amount"}
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={cn(fieldClass, "w-28 font-mono text-xs")}
          />
        </label>
      )}
      {habit.measure === "span" && (
        <>
          <label className="flex flex-col gap-1 text-[0.6875rem] text-muted-foreground">
            From
            <input
              autoFocus
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={cn(fieldClass, "w-28 font-mono text-xs")}
            />
          </label>
          <label className="flex flex-col gap-1 text-[0.6875rem] text-muted-foreground">
            To
            <input
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={cn(fieldClass, "w-28 font-mono text-xs")}
            />
          </label>
        </>
      )}
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-[0.6875rem] text-muted-foreground">
        Note
        <input
          value={note}
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional"
          className={fieldClass}
        />
      </label>
      <div className="flex items-center gap-1.5">
        {entry && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={log.isPending}
            onClick={() =>
              log.mutate(
                { habitId: habit.id, date: today.date, entry: null },
                { onSuccess: onClose },
              )
            }
          >
            Clear
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button type="submit" size="sm" disabled={!ready || log.isPending}>
          Save
        </Button>
      </div>
      {log.isError && (
        <p role="alert" className="w-full text-xs text-destructive">
          Couldn&apos;t save: {log.error.message}. Your entry is still here.
        </p>
      )}
    </form>
  );
}
