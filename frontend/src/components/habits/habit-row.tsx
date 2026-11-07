"use client";

import { ChevronDown, Pencil, RotateCcw, Shield, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useHabitHistory,
  useRestoreHabit,
  useTrashHabit,
  useUpdateHabit,
} from "@/hooks/use-habits";
import { describeSchedule, describeTarget } from "@/lib/habits";
import type { Habit } from "@/lib/types/habits";
import { cn } from "@/lib/utils";

import { ConsistencyHeatmap } from "./consistency-heatmap";
import { HabitForm } from "./habit-form";
import { LogButton, LogForm } from "./log-controls";
import { RecentStrip } from "./recent-strip";

const HISTORY_WEEKS = 26;

function Details({ habit }: { habit: Habit }) {
  const history = useHabitHistory(habit.id, HISTORY_WEEKS);
  const update = useUpdateHabit();
  const trash = useTrashHabit();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="border-t border-border px-4 py-4 sm:pl-31">
        <HabitForm
          habit={habit}
          submitLabel="Save"
          pending={update.isPending}
          error={update.error}
          onCancel={() => setEditing(false)}
          onSubmit={(changes) =>
            update.mutate({ id: habit.id, changes }, { onSuccess: () => setEditing(false) })
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:pl-31">
      {habit.description && <p className="text-sm text-muted-foreground">{habit.description}</p>}
      {history.isPending ? (
        <Skeleton className="h-24 w-full max-w-md" />
      ) : history.isError ? (
        <p className="text-xs text-destructive">
          History couldn&apos;t load: {history.error.message}.
        </p>
      ) : (
        <ConsistencyHeatmap days={history.data} unit={habit.unit} />
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={trash.isPending}
          onClick={() => trash.mutate(habit.id)}
        >
          <Trash2 aria-hidden="true" />
          Move to Trash
        </Button>
        {habit.goal && (
          <span className="ml-auto font-mono text-[0.6875rem] text-faint">
            goal · {habit.goal.title}
          </span>
        )}
      </div>
      {trash.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t move to Trash: {trash.error.message}.
        </p>
      )}
    </div>
  );
}

export function HabitRow({ habit }: { habit: Habit }) {
  const [expanded, setExpanded] = useState(false);
  const [logging, setLogging] = useState(false);
  const { summary } = habit;
  const target = describeTarget(habit);
  const streakLabel = summary.streak_unit === "days" ? "d" : "w";

  return (
    <motion.li layout="position" className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex w-24 shrink-0 justify-start">
          <LogButton habit={habit} onOpenForm={() => setLogging((open) => !open)} />
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-sm">
            {habit.protected && (
              <Shield aria-label="Protected" className="size-3.5 shrink-0 text-primary" />
            )}
            <span className="truncate">{habit.title}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 text-faint transition-transform",
                expanded && "rotate-180",
              )}
            />
          </span>
          <span className="flex flex-wrap gap-x-3 font-mono text-[0.6875rem] text-faint">
            <span>{describeSchedule(habit)}</span>
            {target && <span>{target}</span>}
          </span>
        </button>

        <div className="hidden sm:block">
          <RecentStrip days={summary.recent} />
        </div>

        <div className="flex w-20 shrink-0 flex-col items-end gap-0.5 font-mono text-[0.6875rem] tabular-nums">
          <span className={cn(summary.streak > 0 ? "text-foreground" : "text-faint")}>
            {summary.streak}
            {streakLabel} streak
          </span>
          <span className="text-faint">
            {summary.week_done}/{summary.week_target} wk
          </span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {logging && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <LogForm habit={habit} onClose={() => setLogging(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      {expanded && <Details habit={habit} />}
    </motion.li>
  );
}

export function TrashedHabitRow({ habit }: { habit: Habit }) {
  const restore = useRestoreHabit();
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="min-w-0 truncate text-sm text-muted-foreground">{habit.title}</span>
      <button
        type="button"
        onClick={() => restore.mutate(habit.id)}
        disabled={restore.isPending}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <RotateCcw aria-hidden="true" className="size-3.5" />
        Restore
      </button>
    </li>
  );
}
